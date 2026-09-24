import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'node:path';
import db from '../db/database.ts';
import { CORS_ORIGIN } from '../utils/config.ts';
import { usuarioDe } from '../utils/auth.ts';

/**
 * Defensa contra CSRF además de SameSite=Lax: una petición que modifica datos
 * y trae cabecera Origin debe venir del propio sitio o de un origen permitido.
 */
export function verificarOrigen(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const origen = req.headers.origin;
  if (!origen) return next(); // clientes que no son navegador (curl, scripts)

  const propio = `${req.protocol}://${req.get('host')}`;
  if (origen === propio || CORS_ORIGIN.includes(origen)) return next();

  res.status(403).json({ ok: false, error: 'Origen no permitido' });
}

export const limiteGeneral = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Espera un momento.' },
});

/** Valida que :id sea un entero positivo antes de tocar la base de datos. */
export function validarId(req: Request, res: Response, next: NextFunction, valor: string): void {
  if (!/^\d{1,12}$/.test(valor) || Number(valor) < 1) {
    res.status(400).json({ ok: false, error: 'Identificador inválido' });
    return;
  }
  next();
}

/** Recibos: el administrador ve todos; un conductor solo los que él subió. */
export function permisoArchivo(req: Request, res: Response, next: NextFunction): void {
  const usuario = usuarioDe(req);
  if (usuario.rol === 'admin') return next();
  let nombre: string;
  try { nombre = path.basename(decodeURIComponent(req.path)); } catch { nombre = ''; }
  const propio = db.prepare('SELECT 1 FROM archivos WHERE nombre = ? AND usuario_id = ?').get(nombre, usuario.id);
  if (propio) return next();
  res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
}

/** Límite propio para operaciones costosas, por usuario (no por IP: varios conductores pueden compartir red). */
export const limitePorUsuario = (limit: number, windowMs = 60_000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => `u${req.usuario?.id ?? 'anon'}`,
    validate: { keyGeneratorIpFallback: false },
    message: { ok: false, error: 'Demasiadas solicitudes seguidas. Espera un momento.' },
  });
