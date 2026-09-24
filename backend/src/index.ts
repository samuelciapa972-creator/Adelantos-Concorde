// Primero: carga backend/.env antes de que los demás módulos lean process.env
import './env.ts';

import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import db from './db/database.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { verificarOrigen, limiteGeneral, permisoArchivo } from './middleware/security.ts';
import { requireAuth, requireAdmin, requireConductor } from './utils/auth.ts';
import { middlewareAuditoria } from './utils/auditoria.ts';
import { limpiarArchivosHuerfanos } from './utils/archivos.ts';
import { CORS_ORIGIN, COOKIE_SECURE, ENTORNO_PRODUCCION } from './utils/config.ts';
import type { Conteo } from './types/dominio.ts';

// Rutas
import authRoutes from './routes/auth.ts';
import formularios from './routes/formularios.ts';
import conductores from './routes/conductores.ts';
import meses from './routes/meses.ts';
import cuentas from './routes/cuentas.ts';
import vehiculos from './routes/vehiculos.ts';
import uploads from './routes/uploads.ts';
import gastos from './routes/gastos.ts';
import reportes from './routes/reportes.ts';
import usuarios from './routes/usuarios.ts';
import movil from './routes/movil.ts';

const app = express();
const PORT = process.env.PORT ?? 3001;
const FRONTEND_DIST = path.join(import.meta.dirname, '../../frontend/dist');

// Detrás de un proxy inverso: TRUST_PROXY=1 (nº de saltos) para que req.ip y el
// esquema (http/https) sean los reales. Sin proxy, dejarlo sin definir.
if (process.env.TRUST_PROXY) {
  const v = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v);
}
app.disable('x-powered-by');

// Cabeceras de seguridad
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(COOKIE_SECURE ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  hsts: COOKIE_SECURE,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan(ENTORNO_PRODUCCION ? 'combined' : 'dev'));

// API pública
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api', limiteGeneral);
app.use('/api', verificarOrigen);
app.use('/api/auth', authRoutes);

// Todo lo demás requiere sesión
app.use('/api', requireAuth, middlewareAuditoria);

// App móvil: solo conductores, y solo sus datos
app.use('/api/movil', requireConductor, movil);

// Panel de administración: solo administradores
app.use('/api/formularios', requireAdmin, formularios);
app.use('/api/conductores', requireAdmin, conductores);
app.use('/api/meses', requireAdmin, meses);
app.use('/api/cuentas', requireAdmin, cuentas);
app.use('/api/vehiculos', requireAdmin, vehiculos);
app.use('/api/uploads', requireAdmin, uploads);
app.use('/api/gastos', requireAdmin, gastos);
app.use('/api/reportes', requireAdmin, reportes);
app.use('/api/usuarios', requireAdmin, usuarios);

// Recibos: con sesión; los conductores solo ven los suyos
app.use(
  '/uploads',
  requireAuth,
  permisoArchivo,
  express.static(path.join(import.meta.dirname, '../uploads'), { dotfiles: 'deny', index: false })
);

// API desconocida
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// Frontend compilado (mismo dominio que la API → la cookie de sesión funciona sin CORS)
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST, {
    index: false,
    maxAge: '1h',
    // El service worker y el manifiesto deben revalidarse siempre para que las actualizaciones lleguen
    setHeaders: (res, archivo) => {
      if (/[\\/](sw\.js|manifest\.webmanifest)$/.test(archivo)) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

app.use(errorHandler);

// Solo arranca el servidor al ejecutar este archivo (las pruebas importan `app` sin escuchar)
const esPrincipal = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (esPrincipal) {
  limpiarArchivosHuerfanos();
  setInterval(limpiarArchivosHuerfanos, 6 * 60 * 60 * 1000).unref();

  app.listen(PORT, () => {
    console.log(`\n🚀 Backend corriendo en http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    if (fs.existsSync(FRONTEND_DIST)) console.log('   Sirviendo el frontend compilado (frontend/dist)');
    console.log('');

    if ((db.prepare('SELECT COUNT(*) AS n FROM usuarios').get() as Conteo).n === 0) {
      console.log('⚠  No hay usuarios: nadie podrá iniciar sesión.');
      console.log('   Crea el primero con:  npm run usuario -- admin "Nombre Apellido"\n');
    }
  });
}

export default app;
