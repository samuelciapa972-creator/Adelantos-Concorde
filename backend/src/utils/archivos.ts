import fs from 'node:fs';
import path from 'node:path';
import db from '../db/database.ts';

type Verificador = (cabecera: Buffer) => boolean;

// Firmas ("magic numbers") por tipo: el mimetype y la extensión los declara el
// cliente, así que se comprueba el contenido real del archivo.
const FIRMAS: Record<string, Verificador> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
};

export function contenidoValido(archivo: Pick<Express.Multer.File, 'mimetype' | 'path'>): boolean {
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

export const RUTA_RECIBO = /^\/uploads\/recibos\/([\w.-]+)$/;
export const rutaPublica = (nombre: string): string => '/uploads/recibos/' + path.basename(nombre);

export const registrarArchivo = (nombre: string, usuarioId: number) =>
  db.prepare('INSERT OR IGNORE INTO archivos (nombre, usuario_id) VALUES (?, ?)').run(path.basename(nombre), usuarioId);

/** ¿La ruta '/uploads/recibos/x' la subió este usuario? */
export function esArchivoDe(ruta: string | null | undefined, usuarioId: number): boolean {
  const m = RUTA_RECIBO.exec(ruta ?? '');
  return Boolean(m && db.prepare('SELECT 1 FROM archivos WHERE nombre = ? AND usuario_id = ?').get(m[1], usuarioId));
}

export const RECIBOS_DIR = path.join(import.meta.dirname, '../../uploads/recibos');

/** Borra del disco el archivo de un soporte ('/uploads/recibos/x'), sin esperar ni fallar. */
export function borrarSoporte(ruta: string | null | undefined): void {
  if (!ruta) return;
  fs.unlink(path.join(RECIBOS_DIR, path.basename(ruta)), () => {});
}

/**
 * Borra las fotos que se subieron pero nunca se asociaron a un gasto (p. ej. el conductor
 * salió de la pantalla sin guardar). Solo las de más de 24 h, para no tocar las que están en uso.
 */
export function limpiarArchivosHuerfanos(): number {
  try {
    const huerfanos = db.prepare(`
      SELECT a.nombre FROM archivos a
      WHERE a.creado_en < datetime('now', '-1 day')
        AND NOT EXISTS (SELECT 1 FROM gastos g WHERE g.soporte = '/uploads/recibos/' || a.nombre)
    `).all() as { nombre: string }[];
    for (const { nombre } of huerfanos) {
      fs.rmSync(path.join(RECIBOS_DIR, path.basename(nombre)), { force: true });
      db.prepare('DELETE FROM archivos WHERE nombre = ?').run(nombre);
    }
    if (huerfanos.length) console.log(`[archivos] ${huerfanos.length} foto(s) sin usar eliminadas`);
    return huerfanos.length;
  } catch (err) {
    console.error('[archivos] limpieza fallida:', (err as Error).message);
    return 0;
  }
}
