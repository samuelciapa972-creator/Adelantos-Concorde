import type { UsuarioSesion } from './dominio.ts';

declare global {
  namespace Express {
    interface Request {
      /** Lo define requireAuth. */
      usuario?: UsuarioSesion;
    }
  }
}

export {};
