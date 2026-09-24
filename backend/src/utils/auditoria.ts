import type { NextFunction, Request, Response } from 'express';
import db from '../db/database.ts';

const insertar = db.prepare(`
  INSERT INTO auditoria (usuario_id, usuario, accion, ruta, estado_http, ip)
  VALUES (?, ?, ?, ?, ?, ?)
`);

interface Registro {
  usuarioId?: number | bigint | null;
  usuario?: string | null;
  accion: string;
  ruta: string;
  estado?: number | null;
  ip?: string | null;
}

export function registrar({ usuarioId = null, usuario = null, accion, ruta, estado = null, ip = null }: Registro): void {
  try {
    insertar.run(usuarioId, usuario, accion, String(ruta).slice(0, 300), estado, ip);
  } catch (err) {
    // La auditoría nunca debe tumbar una petición.
    console.error('[auditoria]', (err as Error).message);
  }
}

/** Registra las peticiones que modifican datos y terminaron bien (requiere req.usuario). */
export function middlewareAuditoria(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    registrar({
      usuarioId: req.usuario?.id,
      usuario: req.usuario?.usuario,
      accion: req.method,
      ruta: req.originalUrl.split('?')[0] ?? req.originalUrl,
      estado: res.statusCode,
      ip: req.ip,
    });
  });
  next();
}
