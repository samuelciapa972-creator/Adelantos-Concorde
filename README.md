# Viáticos VH — Gestión de anticipos y legalización

Control de anticipos (formularios), gastos y saldos por bus, titular y relevador,
con reportes mensuales en Excel y PDF.

## Estructura

```
├── package.json             comandos del proyecto (dev, start, setup…)
├── scripts/dev.ts           lanzador de `npm run dev`
├── backend/                 API REST (TypeScript + Node.js + Express + SQLite)
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.ts  conexión + ejecutor de migraciones
│   │   │   ├── migrations/  001_init.sql, 002_...  (una por cambio de esquema)
│   │   │   ├── crear-usuario.ts  (npm run usuario)
│   │   │   ├── saldos.ts    ÚNICA fuente del cálculo de saldos
│   │   │   ├── guards.ts    reglas: mes cerrado no admite cambios
│   │   │   └── seed.ts
│   │   ├── routes/          formularios, gastos, vehiculos, conductores,
│   │   │                    meses, cuentas, uploads, reportes
│   │   ├── middleware/      errorHandler, security (CSRF, límites), upload
│   │   ├── utils/           auth (sesiones), auditoria, config, ocr + ocrParser, archivos
│   │   ├── types/           tipos del dominio (filas de la base) y de Express
│   │   └── index.ts
│   ├── test/                pruebas (node:test)
│   └── .env.example
└── frontend/                React + TypeScript + Vite + Tailwind + React Query
    ├── src/ api/ components/ context/ pages/ utils/
    ├── src/types.ts         modelos que devuelve la API
    ├── src/movil/           app de conductores (PWA)
    └── public/              manifest, service worker e iconos
```

## Requisitos
Node.js 22.18+ y npm 10+.

Todo el proyecto está en **TypeScript** (modo `strict`). El backend no se compila:
Node ejecuta los `.ts` directamente (quita los tipos al cargarlos) y `tsc` solo verifica
los tipos. El frontend lo compila Vite. Por eso el backend usa únicamente sintaxis de
TypeScript que se puede borrar sin transformar (`erasableSyntaxOnly`: nada de `enum`
ni `namespace`).

## Arranque rápido (un solo comando)

Todo se maneja desde la carpeta raíz:

```bash
npm run setup                          # 1ª vez: instala backend y frontend
npm run usuario -- admin "Tu Nombre"   # 1ª vez: crea tu usuario (pide la contraseña)
npm run dev                            # arranca API + frontend juntos → http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo: API (`:3001`, con recarga) y frontend (`:5173`) a la vez, con logs por prefijo. `Ctrl+C` detiene ambos. |
| `npm start` | Producción: compila el frontend y lo sirve junto a la API en **un solo puerto** (`:3001`). |
| `npm run usuario -- <usuario> "<Nombre>"` | Crea un usuario o cambia su contraseña. |
| `npm run seed` | Carga datos de ejemplo. |
| `npm test` | Pruebas del backend. |
| `npm run typecheck` | Verifica los tipos de backend y frontend (`npm run build` también lo hace). |

Si un puerto está ocupado, `npm run dev` lo avisa; puedes usar otros con
`WEB_PORT=5180 API_PORT=3010 npm run dev`.

## Pruebas

```bash
cd backend && npm test
```

## Seguridad

| Capa | Medida |
|---|---|
| Acceso | Toda la API y `/uploads` exigen sesión (cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción, 12 h). Solo `/api/health` y `/api/auth/*` son públicos. |
| Contraseñas | `scrypt` con sal; mínimo 10 caracteres; cambio desde el menú (cierra las demás sesiones). Se guarda solo el hash SHA-256 del token de sesión. |
| Fuerza bruta | 5 fallos por IP+usuario bloquean 15 min; límite general de 300 peticiones/min por IP. |
| CSRF | `SameSite=Lax` + verificación de `Origin` en toda operación que modifica datos. |
| Cabeceras | `helmet`: CSP estricta (`default-src 'self'`, sin scripts inline), `frame-ancestors 'none'`, `nosniff`, HSTS en producción. Tipografías propias (sin CDN). |
| Entrada | Validación con zod en cada ruta, ids numéricos validados, JSON limitado a 100 kB, consultas siempre parametrizadas. |
| Archivos | 10 MB; solo jpg/png/webp/pdf; se comprueba extensión **y** contenido real (firma del archivo); nombres generados por el servidor; el campo `soporte` solo admite rutas de `/uploads/recibos/`. |
| Errores | En 5xx y errores de base de datos no se filtran detalles internos. |
| Auditoría | Tabla `auditoria`: accesos (correctos, fallidos, bloqueados), cambios de contraseña y toda operación que modifica datos, con usuario, ruta e IP. |

```bash
# Consultar la auditoría (últimos 50 eventos)
sqlite3 backend/data/viaticos.db "SELECT creado_en, usuario, accion, ruta, ip FROM auditoria ORDER BY id DESC LIMIT 50"
```

### Usuarios

**Primer usuario:** al abrir la app sin usuarios, la pantalla de ingreso muestra
«Crear el primer usuario» (solo desde el propio equipo del servidor; detrás de un
proxy se rechaza y hay que usar el comando de abajo).


```bash
cd backend
npm run usuario -- admin "Nombre Apellido"   # crea el usuario (pide la contraseña)
npm run usuario -- admin                      # cambia la contraseña y cierra sus sesiones
npm run usuario -- --listar                   # muestra los usuarios existentes
```

El comando pide la contraseña de forma oculta, por lo que **debe ejecutarse en una
terminal interactiva**. En un entorno sin ella (scripts, CI, el prefijo `!` de
Claude Code) indícala con `VIATICOS_PASSWORD='clave-larga' npm run usuario -- admin "Nombre"`
o por tubería (`echo "clave" | npm run usuario -- admin "Nombre"`). Si falta la
contraseña, el comando falla con un mensaje y no crea nada.
En el login se escribe el **usuario** (`admin`), no el nombre completo.

### Producción

```bash
npm run setup
cp backend/.env.example backend/.env    # edita NODE_ENV=production, TRUST_PROXY, etc.
npm start                                # compila el frontend y sirve todo en :3001
```

El backend sirve `frontend/dist`, así que frontend y API comparten origen (la
cookie de sesión lo necesita). Ponlo detrás de un proxy con **HTTPS** (Caddy,
nginx…) y define `NODE_ENV=production` y `TRUST_PROXY=1`. Si se sirve por HTTP en
una red interna, define `COOKIE_SECURE=false`. Haz copias periódicas de
`backend/data/` y `backend/uploads/`.

## App móvil para conductores (PWA)

Los conductores suben el soporte de cada gasto con una **foto**; la app lee el
valor, la fecha, el NIT, el comercio, el número de factura y el tipo de gasto, y el
conductor solo confirma o corrige antes de guardar.

**Flujo**
1. El administrador entra a **Conductores → App móvil → Dar acceso**: se crea un usuario con una
   contraseña temporal que se entrega al conductor (se muestra una sola vez).
2. El conductor abre la dirección del servidor en su celular, ingresa y **cambia la contraseña temporal**.
3. Elige su formulario → **Agregar soporte** → toma la foto → revisa lo leído → **Guardar**.
4. El administrador ve el gasto en el formulario (marcado «App», con proveedor, NIT y N° de factura) y su foto.

**Instalarla como app.** Es una PWA: en Android (Chrome) menú ⋮ → *Instalar la app*;
en iPhone (Safari) *Compartir → Añadir a pantalla de inicio*. La instalación y el
service worker exigen **HTTPS** (o `localhost`); abrirla por `http://IP-del-servidor`
sirve para probar, pero no se podrá instalar.

**Probar desde el celular en la red local** (mismo Wi-Fi que el equipo del servidor):
`npm start` y abrir `http://IP-del-equipo:3001` (no `npm run dev`: el servidor de
desarrollo rechaza peticiones desde otro origen por la protección CSRF).
Si se sirve por HTTP, define `COOKIE_SECURE=false` junto con `NODE_ENV=production`.

**Extracción de datos (OCR).** Se hace en el propio servidor con Tesseract (idioma español
incluido, sin internet y sin enviar las fotos a terceros). Tarda ~1–3 s por foto. Es útil
pero no infalible —sobre todo con tiquetes térmicos desvaídos, arrugados o con sombras—, por
eso **nada se guarda solo**: cada dato se muestra como «Leído» o «Revisa» para que el conductor lo confirme.
Si una foto no se puede leer, escribe los datos a mano.

**Reglas y seguridad**
- Un conductor solo ve **sus** formularios, gastos y fotos; el resto de la API le devuelve `403`.
- Solo puede agregar o eliminar soportes de formularios **abiertos** (mes abierto y no legalizado).
- Contraseña temporal obligatoria de cambiar; sesión de 14 días en el celular (12 h en el panel).
- Aviso de posible **factura duplicada** (mismo NIT y N° de factura) y una foto no puede usarse dos veces.
- Las fotos subidas que nunca se asocian a un gasto se borran solas a las 24 h.
- Límite de 20 lecturas de foto por minuto por usuario.

## Reglas de negocio

- **Total facturas** = `tasa_uso + hospedaje + mantenimiento + gastos`.
- **Saldo real** = `anticipo − total facturas`.
  - Positivo → a favor de la empresa (`saldo_empresa` / `saldo_empresa_relevador`).
  - Negativo → a favor del conductor (`saldo_conductor` / `saldo_relevador`).
- Un vehículo tiene como máximo **un titular y un relevador**.
- Un **mes cerrado** rechaza (409) crear, editar o borrar formularios y gastos.
  Se reabre con `PATCH /api/meses/:id/reabrir`.

## API

Todas las rutas (salvo salud y auth) requieren sesión; las del panel, rol administrador. Las respuestas son `{ ok, data }` o `{ ok:false, error }`.

| Recurso | Endpoints |
|---|---|
| Formularios | `GET /api/formularios?mes_id=&conductor_id=&vehiculo_id=&estado=` · `GET/PUT/DELETE /api/formularios/:id` · `POST /api/formularios` · `PATCH /api/formularios/:id/legalizar` |
| Gastos | `GET /api/gastos?formulario_id=` · `GET/PUT/DELETE /api/gastos/:id` · `POST /api/gastos` |
| Vehículos | `GET/POST /api/vehiculos` · `GET/PUT/DELETE /api/vehiculos/:id` · `PATCH /api/vehiculos/:id/conductores` |
| Conductores | `GET/POST /api/conductores` · `GET/PUT/DELETE /api/conductores/:id` |
| Meses | `GET/POST /api/meses` · `GET /api/meses/:id/resumen?vehiculo_id=` · `PATCH /api/meses/:id/cerrar` · `PATCH /api/meses/:id/reabrir` |
| Cuentas | `GET/POST /api/cuentas` · `PUT /api/cuentas/:id` |
| Recibos | `POST /api/uploads` (campo `archivo`) → se sirven en `/uploads/recibos/...` |
| Reportes | `GET /api/reportes/excel/:mesId` · `GET /api/reportes/pdf/:mesId` (opcional `?vehiculo_id=`) |
| Usuarios (conductores) | `GET/POST /api/usuarios` · `POST /api/usuarios/:id/password` · `PATCH /api/usuarios/:id/activo` |
| App móvil (solo conductores) | `GET /api/movil/perfil` · `GET /api/movil/formularios` · `GET /api/movil/formularios/:id/gastos` · `POST /api/movil/analizar` (foto → datos) · `POST /api/movil/gastos` · `DELETE /api/movil/gastos/:id` |
| Auth | `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `POST /api/auth/password` |
| Salud | `GET /api/health` (pública) |

## Base de datos

SQLite en `backend/data/viaticos.db` (ignorada por git). Al arrancar se aplican
las migraciones pendientes de `backend/src/db/migrations/`. Para cambiar el
esquema, **crea una migración nueva** (`003_descripcion.sql`); no edites las ya
aplicadas. Para resetear: borra el archivo y corre `npm run seed`.

**Respaldo:** con el servidor detenido copia `backend/data/`; en caliente usa
`sqlite3 backend/data/viaticos.db ".backup copia.db"` (WAL activo: no copies solo el `.db`).

## Configuración

Variables de entorno documentadas en `backend/.env.example`: `PORT`, `NODE_ENV`,
`COOKIE_SECURE`, `CORS_ORIGIN`, `TRUST_PROXY`, `DB_PATH`.

## Despliegue

Ver *Seguridad → Producción*. Requiere un host Node con disco persistente
(SQLite y `uploads/` viven en disco). Si se migrara a PostgreSQL habría que
reescribir `database.js` y las consultas hechas con `better-sqlite3`.
