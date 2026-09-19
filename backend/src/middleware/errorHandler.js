const { ZodError } = require('zod');
const multer = require('multer');
const { ENTORNO_PRODUCCION } = require('../utils/config');

/**
 * Middleware de errores — siempre va al final de app.use()
 */
function errorHandler(err, req, res, next) {
  // Error de validación Zod
  if (err instanceof ZodError) {
    return res.status(400).json({
      ok: false,
      error: 'Datos inválidos: ' + err.errors
        .slice(0, 3)
        .map(e => (e.path.length ? `${e.path.join('.')} — ${e.message}` : e.message))
        .join('; '),
      detalles: err.errors.map(e => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  }

  // Error de subida de archivos (tamaño, campo inesperado, etc.)
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      ok: false,
      error: err.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo supera el límite de 10 MB'
        : err.message,
    });
  }

  // Error de constraint SQLite (llave foránea, UNIQUE, etc.)
  if (err.code?.startsWith('SQLITE_')) {
    let mensaje = 'Conflicto en base de datos';
    if (err.code.includes('UNIQUE') || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      mensaje = 'Ya existe un registro con ese valor (por ejemplo número de formulario, placa o nombre)';
    } else if (err.code.includes('FOREIGN')) {
      mensaje = 'El registro está relacionado con otros datos y no puede modificarse así';
    } else if (err.code.includes('NOTNULL')) {
      mensaje = 'Falta un dato obligatorio';
    }
    console.error('[DB]', err.code, err.message);
    return res.status(409).json({
      ok: false,
      error: mensaje,
      ...(ENTORNO_PRODUCCION ? {} : { detalles: err.message }),
    });
  }

  // JSON mal formado enviado por el cliente
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'JSON inválido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: 'La solicitud es demasiado grande' });
  }

  const status = err.status ?? 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({
    ok: false,
    // En 5xx no se filtran detalles internos.
    error: status >= 500 ? 'Error interno del servidor' : err.message,
  });
}

/**
 * Helper para envolver handlers async y capturar errores sin try/catch
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { errorHandler, asyncHandler };
