export const ENTORNO_PRODUCCION = process.env.NODE_ENV === 'production';

// La cookie de sesión solo viaja por HTTPS en producción.
// Si en producción se sirve por HTTP (red interna sin certificado), definir COOKIE_SECURE=false.
export const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : ENTORNO_PRODUCCION;

export const CORS_ORIGIN = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
