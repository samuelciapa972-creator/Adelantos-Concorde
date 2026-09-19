// Carga backend/.env si existe (antes de leer la configuración)
const envFile = require('path').join(__dirname, '../.env');
if (require('fs').existsSync(envFile)) process.loadEnvFile(envFile);

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const { errorHandler } = require('./middleware/errorHandler');
const { verificarOrigen, limiteGeneral, permisoArchivo } = require('./middleware/security');
const { requireAuth, requireAdmin, requireConductor } = require('./utils/auth');
const { middlewareAuditoria } = require('./utils/auditoria');
const { CORS_ORIGIN, COOKIE_SECURE, ENTORNO_PRODUCCION } = require('./utils/config');

// Rutas
const authRoutes = require('./routes/auth');
const formularios = require('./routes/formularios');
const conductores = require('./routes/conductores');
const meses = require('./routes/meses');
const cuentas = require('./routes/cuentas');
const vehiculos = require('./routes/vehiculos');
const uploads = require('./routes/uploads');
const gastos = require('./routes/gastos');
const reportes = require('./routes/reportes');
const usuarios = require('./routes/usuarios');
const movil = require('./routes/movil');

const app = express();
const PORT = process.env.PORT ?? 3001;
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');

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
  express.static(path.join(__dirname, '../uploads'), { dotfiles: 'deny', index: false })
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

if (require.main === module) {
  const { limpiarArchivosHuerfanos } = require('./utils/archivos');
  limpiarArchivosHuerfanos();
  setInterval(limpiarArchivosHuerfanos, 6 * 60 * 60 * 1000).unref();

  app.listen(PORT, () => {
    console.log(`\n🚀 Backend corriendo en http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    if (fs.existsSync(FRONTEND_DIST)) console.log('   Sirviendo el frontend compilado (frontend/dist)');
    console.log('');

    const db = require('./db/database');
    if (db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n === 0) {
      console.log('⚠  No hay usuarios: nadie podrá iniciar sesión.');
      console.log('   Crea el primero con:  npm run usuario -- admin "Nombre Apellido"\n');
    }
  });
}

module.exports = app;
