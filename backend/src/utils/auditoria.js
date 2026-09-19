const db = require('../db/database');

const insertar = db.prepare(`
  INSERT INTO auditoria (usuario_id, usuario, accion, ruta, estado_http, ip)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function registrar({ usuarioId = null, usuario = null, accion, ruta, estado = null, ip = null }) {
  try {
    insertar.run(usuarioId, usuario, accion, String(ruta).slice(0, 300), estado, ip);
  } catch (err) {
    // La auditoría nunca debe tumbar una petición.
    console.error('[auditoria]', err.message);
  }
}

/** Registra las peticiones que modifican datos y terminaron bien (requiere req.usuario). */
function middlewareAuditoria(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    registrar({
      usuarioId: req.usuario?.id,
      usuario: req.usuario?.usuario,
      accion: req.method,
      ruta: req.originalUrl.split('?')[0],
      estado: res.statusCode,
      ip: req.ip,
    });
  });
  next();
}

module.exports = { registrar, middlewareAuditoria };
