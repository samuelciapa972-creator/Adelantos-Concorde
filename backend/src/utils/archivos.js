const fs = require('fs');
const path = require('path');
const db = require('../db/database');

// Firmas ("magic numbers") por tipo: el mimetype y la extensión los declara el
// cliente, así que se comprueba el contenido real del archivo.
const FIRMAS = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

function contenidoValido(archivo) {
  const verificar = FIRMAS[archivo.mimetype];
  if (!verificar) return false;
  const fd = fs.openSync(archivo.path, 'r');
  try {
    const cabecera = Buffer.alloc(16);
    fs.readSync(fd, cabecera, 0, 16, 0);
    return verificar(cabecera);
  } finally {
    fs.closeSync(fd);
  }
}

const RUTA_RECIBO = /^\/uploads\/recibos\/([\w.-]+)$/;
const rutaPublica = (nombre) => '/uploads/recibos/' + path.basename(nombre);

const registrarArchivo = (nombre, usuarioId) =>
  db.prepare('INSERT OR IGNORE INTO archivos (nombre, usuario_id) VALUES (?, ?)').run(path.basename(nombre), usuarioId);

/** ¿La ruta '/uploads/recibos/x' la subió este usuario? */
function esArchivoDe(ruta, usuarioId) {
  const m = RUTA_RECIBO.exec(ruta ?? '');
  return Boolean(m && db.prepare('SELECT 1 FROM archivos WHERE nombre = ? AND usuario_id = ?').get(m[1], usuarioId));
}

const RECIBOS_DIR = path.join(__dirname, '../../uploads/recibos');

/**
 * Borra las fotos que se subieron pero nunca se asociaron a un gasto (p. ej. el conductor
 * salió de la pantalla sin guardar). Solo las de más de 24 h, para no tocar las que están en uso.
 */
function limpiarArchivosHuerfanos() {
  try {
    const huerfanos = db.prepare(`
      SELECT a.nombre FROM archivos a
      WHERE a.creado_en < datetime('now', '-1 day')
        AND NOT EXISTS (SELECT 1 FROM gastos g WHERE g.soporte = '/uploads/recibos/' || a.nombre)
    `).all();
    for (const { nombre } of huerfanos) {
      fs.rmSync(path.join(RECIBOS_DIR, path.basename(nombre)), { force: true });
      db.prepare('DELETE FROM archivos WHERE nombre = ?').run(nombre);
    }
    if (huerfanos.length) console.log(`[archivos] ${huerfanos.length} foto(s) sin usar eliminadas`);
    return huerfanos.length;
  } catch (err) {
    console.error('[archivos] limpieza fallida:', err.message);
    return 0;
  }
}

module.exports = { limpiarArchivosHuerfanos, contenidoValido, rutaPublica, registrarArchivo, esArchivoDe, RUTA_RECIBO };
