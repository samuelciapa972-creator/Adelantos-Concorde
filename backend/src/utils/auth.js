const crypto = require('crypto');
const db = require('../db/database');
const { COOKIE_SECURE } = require('./config');

const PASSWORD_MIN = 10;

const COOKIE = 'sid';
// Los conductores usan el celular a diario: su sesión dura más que la de escritorio.
const SESION_HORAS = 12;
const SESION_HORAS_CONDUCTOR = 24 * 14;

const horasDeSesion = (rol) => (rol === 'conductor' ? SESION_HORAS_CONDUCTOR : SESION_HORAS);

// ── Contraseñas (scrypt, incluido en Node) ───────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verificarPassword(password, almacenado) {
  const [alg, saltHex, hashHex] = String(almacenado).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

// ── Sesiones ─────────────────────────────────────────────────────────────────
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

function crearSesion(usuarioId, rol = 'admin') {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO sesiones (token_hash, usuario_id, expira_en)
    VALUES (?, ?, datetime('now', ?))
  `).run(sha256(token), usuarioId, `+${horasDeSesion(rol)} hours`);
  return token;
}

function usuarioDeToken(token) {
  if (!token) return null;
  return db.prepare(`
    SELECT u.id, u.usuario, u.nombre, u.rol, u.conductor_id, u.debe_cambiar_password
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_en > datetime('now') AND u.activo = 1
  `).get(sha256(token)) ?? null;
}

function cerrarSesion(token) {
  if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token));
}

/** Cierra todas las sesiones del usuario, salvo (opcionalmente) la del token indicado. */
function cerrarSesionesDeUsuario(usuarioId, tokenConservado = null) {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?')
    .run(usuarioId, tokenConservado ? sha256(tokenConservado) : '');
}

function limpiarSesionesVencidas() {
  db.prepare("DELETE FROM sesiones WHERE expira_en <= datetime('now')").run();
}

// ── Cookie ───────────────────────────────────────────────────────────────────
function leerToken(req) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  };
}

// ── Middleware ───────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const usuario = usuarioDeToken(leerToken(req));
  if (!usuario) {
    return res.status(401).json({ ok: false, error: 'No autenticado' });
  }
  // Contraseña temporal: hasta cambiarla solo se permiten las rutas /api/auth/*
  if (usuario.debe_cambiar_password) {
    return res.status(403).json({ ok: false, codigo: 'CAMBIAR_PASSWORD', error: 'Debes cambiar tu contraseña antes de continuar' });
  }
  req.usuario = usuario;
  next();
}

const soloRol = (rol) => (req, res, next) =>
  req.usuario?.rol === rol
    ? next()
    : res.status(403).json({ ok: false, error: 'No tienes permiso para esta sección' });

const requireAdmin = soloRol('admin');
const requireConductor = soloRol('conductor');

/** Datos del usuario que el cliente necesita conocer (nunca el hash). */
const publico = (u) => ({
  id: u.id,
  usuario: u.usuario,
  nombre: u.nombre,
  rol: u.rol,
  conductor_id: u.conductor_id ?? null,
  debe_cambiar_password: Boolean(u.debe_cambiar_password),
});

module.exports = {
  COOKIE, SESION_HORAS, horasDeSesion,
  hashPassword, verificarPassword,
  PASSWORD_MIN,
  crearSesion, usuarioDeToken, cerrarSesion, cerrarSesionesDeUsuario, limpiarSesionesVencidas,
  leerToken, opcionesCookie, requireAuth, requireAdmin, requireConductor, publico,
};
