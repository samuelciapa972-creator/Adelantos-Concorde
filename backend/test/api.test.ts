import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Request, Response } from 'express';

// La base en memoria debe configurarse antes de cargar la app: por eso los imports dinámicos.
process.env.DB_PATH = ':memory:';
process.env.CORS_ORIGIN = 'http://localhost:5173';

const { default: db } = await import('../src/db/database.ts');
const auth = await import('../src/utils/auth.ts');
const { default: app } = await import('../src/index.ts');
const { errorHandler } = await import('../src/middleware/errorHandler.ts');

const PASS = 'clave-segura-123';
db.prepare("INSERT INTO usuarios (usuario, nombre, password_hash) VALUES ('ana','Ana',?)").run(auth.hashPassword(PASS));

let base: string;
let server: Server;
let cookie = '';
const subidos: string[] = [];

test.before(async () => {
  await new Promise<void>((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.after(() => {
  server.close();
  subidos.forEach((f) => fs.rmSync(path.join(import.meta.dirname, '../uploads/recibos', f), { force: true }));
});

interface Opciones {
  body?: unknown;
  headers?: Record<string, string>;
  raw?: string;
}

// Las respuestas JSON se inspeccionan campo a campo en cada prueba: se dejan sin tipar.
type Json = any;

async function api(metodo: string, ruta: string, { body, headers = {}, raw }: Opciones = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const texto = await res.text();
  let json: Json = null; try { json = JSON.parse(texto); } catch { /* respuesta no JSON */ }
  return { status: res.status, json, headers: res.headers };
}

test('sin sesión: API, recibos y reportes devuelven 401; health es pública', async () => {
  assert.equal((await api('GET', '/api/health')).status, 200);
  for (const ruta of ['/api/formularios', '/api/reportes/pdf/1', '/uploads/recibos/x.png', '/api/gastos']) {
    assert.equal((await api('GET', ruta)).status, 401, ruta);
  }
});

test('cabeceras de seguridad presentes', async () => {
  const { headers } = await api('GET', '/api/health');
  const csp = headers.get('content-security-policy') ?? '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-powered-by'), null);
});

test('login: cookie HttpOnly + SameSite; credenciales malas → 401', async () => {
  assert.equal((await api('POST', '/api/auth/login', { body: { usuario: 'ana', password: 'x' } })).status, 401);
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ usuario: 'ANA', password: PASS }),
  });
  assert.equal(res.status, 200);
  const set = res.headers.get('set-cookie') ?? '';
  assert.match(set, /HttpOnly/);
  assert.match(set, /SameSite=Lax/);
  cookie = set.split(';')[0] ?? '';
});

test('CSRF: origen ajeno rechazado en operaciones que modifican; propio o sin origen pasa', async () => {
  const cuerpo = { nombre: 'Enero', anio: 2026 };
  const malo = await api('POST', '/api/meses', { body: cuerpo, headers: { origin: 'https://evil.example' } });
  assert.equal(malo.status, 403);
  const bueno = await api('POST', '/api/meses', { body: cuerpo, headers: { origin: 'http://localhost:5173' } });
  assert.equal(bueno.status, 201);
});

test('ids inválidos → 400; JSON roto → 400', async () => {
  assert.equal((await api('GET', '/api/formularios/abc')).status, 400);
  assert.equal((await api('GET', '/api/formularios/0')).status, 400);
  assert.equal((await api('DELETE', "/api/gastos/1;DROP TABLE gastos")).status, 400);
  assert.equal((await api('POST', '/api/meses', { raw: '{malo', headers: { 'content-type': 'application/json' } })).status, 400);
});

test('meses: solo nombres reales', async () => {
  assert.equal((await api('POST', '/api/meses', { body: { nombre: '../../x', anio: 2026 } })).status, 400);
});

let vehiculoId: number, titularId: number, relevoId: number, mesId: number, formularioId: number;

test('vehículo nuevo crea su cuenta automáticamente y asigna conductores', async () => {
  titularId = (await api('POST', '/api/conductores', { body: { nombre: 'Luis Pérez' } })).json.data.id;
  relevoId = (await api('POST', '/api/conductores', { body: { nombre: 'Ana Gómez' } })).json.data.id;
  const v = await api('POST', '/api/vehiculos', { body: { numero_interno: '900', placa: 'abc-123' } });
  assert.equal(v.status, 201);
  assert.equal(v.json.data.placa, 'ABC-123');
  assert.equal(v.json.data.cuenta_codigo, '900');
  vehiculoId = v.json.data.id;

  assert.equal((await api('PATCH', `/api/vehiculos/${vehiculoId}/conductores`, { body: { titular_id: titularId, relevador_id: titularId } })).status, 400);
  assert.equal((await api('PATCH', `/api/vehiculos/${vehiculoId}/conductores`, { body: { titular_id: titularId, relevador_id: relevoId } })).status, 200);
  const dup = await api('POST', '/api/vehiculos', { body: { numero_interno: '900', placa: 'ZZZ-999' } });
  assert.equal(dup.status, 409);
  assert.match(dup.json.error, /Ya existe/);
});

test('conductor: iniciales automáticas; al desactivar se libera del vehículo', async () => {
  const c = (await api('GET', `/api/conductores/${titularId}`)).json.data;
  assert.equal(c.iniciales, 'LP');
  assert.equal((await api('DELETE', `/api/conductores/${relevoId}`)).status, 200);
  assert.equal((await api('GET', `/api/vehiculos/${vehiculoId}`)).json.data.relevador, null);
});

test('formulario: regreso anterior a salida es inválido', async () => {
  mesId = (await api('GET', '/api/meses')).json.data[0].id;
  const base_ = { numero: 'T1', fecha_dia: 3, conductor_id: titularId, vehiculo_id: vehiculoId, mes_id: mesId, anticipo: 100000, tasa_uso: 20000 };
  const mal = await api('POST', '/api/formularios', { body: { ...base_, fecha_salida: '2026-01-10', fecha_regreso: '2026-01-05' } });
  assert.equal(mal.status, 400);
  const ok = await api('POST', '/api/formularios', { body: base_ });
  assert.equal(ok.status, 201);
  formularioId = ok.json.data.id;
});

test('gasto: soporte solo acepta rutas de /uploads/recibos (no javascript:)', async () => {
  const g = { formulario_id: formularioId, fecha: '2026-01-03', tipo: 'peaje', concepto: 'Peaje', valor: 8000 };
  assert.equal((await api('POST', '/api/gastos', { body: { ...g, soporte: 'javascript:alert(1)' } })).status, 400);
  assert.equal((await api('POST', '/api/gastos', { body: { ...g, soporte: '/uploads/recibos/../../etc/passwd' } })).status, 400);
  assert.equal((await api('POST', '/api/gastos', { body: { ...g, soporte: '/uploads/recibos/1-2.png' } })).status, 201);
});

test('subida: el contenido debe coincidir con el tipo (una imagen falsa se rechaza)', async () => {
  const subir = async (bytes: string | Buffer, nombre: string, tipo: string) => {
    const fd = new FormData();
    fd.append('archivo', new Blob([new Uint8Array(Buffer.from(bytes))], { type: tipo }), nombre);
    const res = await fetch(base + '/api/uploads', { method: 'POST', headers: { cookie }, body: fd });
    return { status: res.status, json: (await res.json()) as Json };
  };
  const falsa = await subir('<script>alert(1)</script>', 'x.png', 'image/png');
  assert.equal(falsa.status, 400);
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const buena = await subir(png, 'recibo.PNG', 'image/png');
  assert.equal(buena.status, 200);
  subidos.push(path.basename(buena.json.data.ruta));
  assert.match(buena.json.data.ruta, /^\/uploads\/recibos\/[\w.-]+\.png$/);
  // y se puede descargar con sesión
  const get = await fetch(base + buena.json.data.ruta, { headers: { cookie } });
  assert.equal(get.status, 200);
});

test('reporte: nombre de archivo seguro y mes inexistente → 404', async () => {
  const r = await fetch(base + `/api/reportes/pdf/${mesId}`, { headers: { cookie } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition') ?? '', /^attachment; filename=[\w.-]+\.pdf$/);
  assert.equal((await api('GET', '/api/reportes/pdf/99999')).status, 404);
});

test('cambio de contraseña: valida la actual, exige 10+ y cierra otras sesiones', async () => {
  const otra = auth.crearSesion(1);
  assert.equal((await api('POST', '/api/auth/password', { body: { actual: 'mala', nueva: 'nueva-clave-456' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/password', { body: { actual: PASS, nueva: 'corta' } })).status, 400);
  assert.equal((await api('POST', '/api/auth/password', { body: { actual: PASS, nueva: 'nueva-clave-456' } })).status, 200);
  assert.equal(auth.usuarioDeToken(otra), null, 'la otra sesión debe cerrarse');
  assert.equal((await api('GET', '/api/auth/me')).status, 200, 'la sesión actual se conserva');
});

test('auditoría: registra accesos y cambios, sin GET', async () => {
  const acciones = db.prepare('SELECT accion, ruta, usuario FROM auditoria').all() as { accion: string; ruta: string; usuario: string }[];
  assert.ok(acciones.some(a => a.accion === 'LOGIN' && a.usuario === 'ana'));
  assert.ok(acciones.some(a => a.accion === 'LOGIN_FALLIDO'));
  assert.ok(acciones.some(a => a.accion === 'POST' && a.ruta === '/api/formularios'));
  assert.ok(!acciones.some(a => a.accion === 'GET'));
});

test('errores 5xx/SQL no filtran detalles internos en producción', () => {
  let codigo = 0;
  let salida: { error?: string } = {};
  const res = {
    status(c: number) { codigo = c; return this; },
    json(j: { error?: string }) { salida = j; },
  };
  errorHandler(new Error('detalle secreto: /home/x/db'), {} as Request, res as unknown as Response, () => {});
  assert.equal(codigo, 500);
  assert.equal(salida.error, 'Error interno del servidor');
});

test('logout invalida la sesión', async () => {
  assert.equal((await api('POST', '/api/auth/logout')).status, 200);
  assert.equal((await api('GET', '/api/formularios')).status, 401);
});
