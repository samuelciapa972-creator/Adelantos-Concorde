import crypto from 'node:crypto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import db from '../db/database.ts';
import { COOKIE_SECURE } from './config.ts';
import { HttpError } from './errores.ts';
import type { Rol, UsuarioSesion } from '../types/dominio.ts';

export const PASSWORD_MIN = 10;

export const COOKIE = 'sid';
// Los conductores usan el celular a diario: su sesión dura más que la de escritorio.
export const SESION_HORAS = 12;
const SESION_HORAS_CONDUCTOR = 24 * 14;

export const horasDeSesion = (rol: Rol): number => (rol === 'conductor' ? SESION_HORAS_CONDUCTOR : SESION_HORAS);

// ── Contraseñas (scrypt, incluido en Node) ───────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const [alg, saltHex, hashHex] = String(almacenado).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), esperado.length);
  return crypto.timingSafeEqual(esperado, calculado);
}

// ── Sesiones ─────────────────────────────────────────────────────────────────
const sha256 = (s: string): string => crypto.createHash('sha256').update(s).digest('hex');

export function crearSesion(usuarioId: number | bigint, rol: Rol = 'admin'): string {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO sesiones (token_hash, usuario_id, expira_en)
    VALUES (?, ?, datetime('now', ?))
  `).run(sha256(token), usuarioId, `+${horasDeSesion(rol)} hours`);
  return token;
}

export function usuarioDeToken(token: string | null | undefined): UsuarioSesion | null {
  if (!token) return null;
  const fila = db.prepare(`
    SELECT u.id, u.usuario, u.nombre, u.rol, u.conductor_id, u.debe_cambiar_password
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_en > datetime('now') AND u.activo = 1
  `).get(sha256(token)) as UsuarioSesion | undefined;
  return fila ?? null;
}

export function cerrarSesion(token: string | null): void {
  if (token) db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(sha256(token));
}

/** Cierra todas las sesiones del usuario, salvo (opcionalmente) la del token indicado. */
export function cerrarSesionesDeUsuario(usuarioId: number, tokenConservado: string | null = null): void {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?')
    .run(usuarioId, tokenConservado ? sha256(tokenConservado) : '');
}

export function limpiarSesionesVencidas(): void {
  db.prepare("DELETE FROM sesiones WHERE expira_en <= datetime('now')").run();
}

// ── Cookie ───────────────────────────────────────────────────────────────────
export function leerToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function opcionesCookie(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    path: '/',
  };
}

// ── Middleware ───────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction) {
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

const soloRol = (rol: Rol) => (req: Request, res: Response, next: NextFunction) =>
  req.usuario?.rol === rol
    ? next()
    : res.status(403).json({ ok: false, error: 'No tienes permiso para esta sección' });

export const requireAdmin = soloRol('admin');
export const requireConductor = soloRol('conductor');

/** Usuario de la sesión en rutas protegidas por requireAuth. */
export function usuarioDe(req: Request): UsuarioSesion {
  if (!req.usuario) throw new HttpError('No autenticado', 401);
  return req.usuario;
}

/** Conductor de la sesión en rutas protegidas por requireConductor. */
export function conductorDe(req: Request): UsuarioSesion & { conductor_id: number } {
  const u = usuarioDe(req);
  if (u.conductor_id == null) throw new HttpError('No tienes permiso para esta sección', 403);
  return { ...u, conductor_id: u.conductor_id };
}

type DatosPublicos = Pick<UsuarioSesion, 'id' | 'usuario' | 'nombre' | 'rol'> &
  Partial<Pick<UsuarioSesion, 'conductor_id' | 'debe_cambiar_password'>>;

/** Datos del usuario que el cliente necesita conocer (nunca el hash). */
export const publico = (u: DatosPublicos) => ({
  id: Number(u.id),
  usuario: u.usuario,
  nombre: u.nombre,
  rol: u.rol,
  conductor_id: u.conductor_id ?? null,
  debe_cambiar_password: Boolean(u.debe_cambiar_password),
});
