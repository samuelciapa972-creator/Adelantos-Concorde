const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('../db/database');
const { CORS_ORIGIN } = require('../utils/config');

/**
 * Defensa contra CSRF además de SameSite=Lax: una petición que modifica datos
 * y trae cabecera Origin debe venir del propio sitio o de un origen permitido.
 */
function verificarOrigen(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origen = req.headers.origin;
  if (!origen) return next(); // clientes que no son navegador (curl, scripts)

  const propio = `${req.protocol}://${req.get('host')}`;
  if (origen === propio || CORS_ORIGIN.includes(origen)) return next();

  res.status(403).json({ ok: false, error: 'Origen no permitido' });
}

const limiteGeneral = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Espera un momento.' },
});

/** Valida que :id sea un entero positivo antes de tocar la base de datos. */
function validarId(req, res, next, valor) {
  if (!/^\d{1,12}$/.test(valor) || Number(valor) < 1) {
    return res.status(400).json({ ok: false, error: 'Identificador inválido' });
  }
  next();
}

/** Recibos: el administrador ve todos; un conductor solo los que él subió. */
function permisoArchivo(req, res, next) {
  if (req.usuario.rol === 'admin') return next();
  let nombre;
  try { nombre = path.basename(decodeURIComponent(req.path)); } catch { nombre = ''; }
  const propio = db.prepare('SELECT 1 FROM archivos WHERE nombre = ? AND usuario_id = ?').get(nombre, req.usuario.id);
  if (propio) return next();
  res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
}

/** Límite propio para operaciones costosas, por usuario (no por IP: varios conductores pueden compartir red). */
const limitePorUsuario = (limit, windowMs = 60_000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `u${req.usuario?.id ?? 'anon'}`,
    validate: { keyGeneratorIpFallback: false },
    message: { ok: false, error: 'Demasiadas solicitudes seguidas. Espera un momento.' },
  });

module.exports = { verificarOrigen, limiteGeneral, validarId, permisoArchivo, limitePorUsuario };
