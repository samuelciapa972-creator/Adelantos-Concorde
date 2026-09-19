const express = require('express');
const { z } = require('zod');
const db = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../utils/auth');
const { registrar } = require('../utils/auditoria');

const router = express.Router();

const LoginSchema = z.object({
  usuario:  z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

// Freno a fuerza bruta: 5 fallos por (ip+usuario) bloquean 15 min. En memoria.
const MAX_INTENTOS = 5;
const BLOQUEO_MS = 15 * 60 * 1000;
const fallos = new Map();

const claveIntento = (req, usuario) => `${req.ip}|${String(usuario).toLowerCase()}`;

function bloqueado(clave) {
  const f = fallos.get(clave);
  if (!f) return false;
  if (Date.now() > f.hasta) { fallos.delete(clave); return false; }
  return f.n >= MAX_INTENTOS;
}

function registrarFallo(clave) {
  const f = fallos.get(clave) ?? { n: 0 };
  f.n += 1;
  f.hasta = Date.now() + BLOQUEO_MS;
  fallos.set(clave, f);
}

// Hash falso para igualar el tiempo de respuesta cuando el usuario no existe.
const HASH_FALSO = auth.hashPassword('no-existe');

// ── Primer arranque: crear el primer usuario desde el navegador ──────────────
const totalUsuarios = () => db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n;

// Solo desde el propio equipo y sin cabeceras de proxy: un proxy en la misma máquina
// haría que todos parecieran locales, así que su presencia también lo bloquea.
function esPeticionLocal(req) {
  const ip = req.socket.remoteAddress ?? '';
  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip);
  return loopback && !req.headers['x-forwarded-for'] && !req.headers.forwarded;
}

const SetupSchema = z.object({
  usuario:  z.string().regex(/^[A-Za-z0-9._-]{3,50}$/, 'El usuario solo admite letras, números, punto, guion y guion bajo (3 a 50 caracteres)'),
  nombre:   z.string().trim().min(2, 'Escribe tu nombre completo').max(100),
  password: z.string().min(auth.PASSWORD_MIN, `La contraseña debe tener al menos ${auth.PASSWORD_MIN} caracteres`).max(200),
});

// GET /api/auth/estado — ¿hay que crear el primer usuario?
router.get('/estado', (req, res) => {
  const configurado = totalUsuarios() > 0;
  res.json({ ok: true, data: { configurado, puedeConfigurar: !configurado && esPeticionLocal(req) } });
});

// POST /api/auth/setup — crea el primer usuario (solo si no existe ninguno y desde este equipo)
router.post('/setup', asyncHandler((req, res) => {
  if (totalUsuarios() > 0) {
    return res.status(409).json({ ok: false, error: 'Ya existe un usuario. Inicia sesión.' });
  }
  if (!esPeticionLocal(req)) {
    return res.status(403).json({
      ok: false,
      error: 'El primer usuario solo puede crearse desde el propio equipo del servidor. Usa: npm run usuario -- admin "Nombre"',
    });
  }

  const { usuario, nombre, password } = SetupSchema.parse(req.body);
  const hash = auth.hashPassword(password);

  // Dentro de una transacción para que dos peticiones simultáneas no creen dos "primeros" usuarios
  const id = db.transaction(() => {
    if (totalUsuarios() > 0) return null;
    return db.prepare('INSERT INTO usuarios (usuario, nombre, password_hash) VALUES (?, ?, ?)')
      .run(usuario, nombre, hash).lastInsertRowid;
  })();
  if (!id) return res.status(409).json({ ok: false, error: 'Ya existe un usuario. Inicia sesión.' });

  registrar({ usuarioId: id, usuario, accion: 'SETUP_PRIMER_USUARIO', ruta: req.originalUrl, estado: 201, ip: req.ip });
  const token = auth.crearSesion(id, 'admin');
  res.cookie(auth.COOKIE, token, { ...auth.opcionesCookie(), maxAge: auth.horasDeSesion('admin') * 60 * 60 * 1000 });
  res.status(201).json({ ok: true, data: auth.publico({ id, usuario, nombre, rol: 'admin' }) });
}));

// POST /api/auth/login
router.post('/login', asyncHandler((req, res) => {
  const { usuario, password } = LoginSchema.parse(req.body);
  const clave = claveIntento(req, usuario);

  if (bloqueado(clave)) {
    registrar({ usuario, accion: 'LOGIN_BLOQUEADO', ruta: req.originalUrl, estado: 429, ip: req.ip });
    return res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' });
  }

  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario);
  const valido = auth.verificarPassword(password, u?.password_hash ?? HASH_FALSO);

  if (!u || !valido) {
    registrarFallo(clave);
    registrar({ usuario, accion: 'LOGIN_FALLIDO', ruta: req.originalUrl, estado: 401, ip: req.ip });
    return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
  }

  fallos.delete(clave);
  registrar({ usuarioId: u.id, usuario: u.usuario, accion: 'LOGIN', ruta: req.originalUrl, estado: 200, ip: req.ip });
  auth.limpiarSesionesVencidas();
  const token = auth.crearSesion(u.id, u.rol);

  res.cookie(auth.COOKIE, token, {
    ...auth.opcionesCookie(),
    maxAge: auth.horasDeSesion(u.rol) * 60 * 60 * 1000,
  });
  res.json({ ok: true, data: auth.publico(u) });
}));

const CambioPasswordSchema = z.object({
  actual: z.string().min(1).max(200),
  nueva:  z.string().min(auth.PASSWORD_MIN, `La contraseña debe tener al menos ${auth.PASSWORD_MIN} caracteres`).max(200),
});

// POST /api/auth/password — cambia la contraseña propia y cierra las demás sesiones
router.post('/password', asyncHandler((req, res) => {
  const token = auth.leerToken(req);
  const sesion = auth.usuarioDeToken(token);
  if (!sesion) return res.status(401).json({ ok: false, error: 'No autenticado' });

  const { actual, nueva } = CambioPasswordSchema.parse(req.body);
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(sesion.id);

  if (!auth.verificarPassword(actual, u.password_hash)) {
    registrar({ usuarioId: u.id, usuario: u.usuario, accion: 'PASSWORD_FALLIDO', ruta: req.originalUrl, estado: 400, ip: req.ip });
    return res.status(400).json({ ok: false, error: 'La contraseña actual no es correcta' });
  }
  if (actual === nueva) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe ser distinta de la actual' });
  }

  db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0 WHERE id = ?').run(auth.hashPassword(nueva), u.id);
  auth.cerrarSesionesDeUsuario(u.id, token);
  registrar({ usuarioId: u.id, usuario: u.usuario, accion: 'PASSWORD_CAMBIADO', ruta: req.originalUrl, estado: 200, ip: req.ip });
  res.json({ ok: true });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  auth.cerrarSesion(auth.leerToken(req));
  res.clearCookie(auth.COOKIE, auth.opcionesCookie());
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const usuario = auth.usuarioDeToken(auth.leerToken(req));
  if (!usuario) return res.status(401).json({ ok: false, error: 'No autenticado' });
  res.json({ ok: true, data: auth.publico(usuario) });
});

module.exports = router;
