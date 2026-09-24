import test from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Conteo } from '../src/types/dominio.ts';

// La base en memoria debe configurarse antes de cargar la app: por eso los imports dinámicos.
process.env.DB_PATH = ':memory:';

const { default: db } = await import('../src/db/database.ts');
const { default: app } = await import('../src/index.ts');

type Json = any;
const contar = (sql: string) => (db.prepare(sql).get() as Conteo).n;

let base: string;
let server: Server;
test.before(async () => {
  await new Promise<void>((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
test.after(() => server.close());

const post = (ruta: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const valido = { usuario: 'admin', nombre: 'Ana Admin', password: 'clave-segura-123' };

test('sin usuarios: /estado indica que hay que configurar y que es posible desde el equipo local', async () => {
  const j = (await (await fetch(base + '/api/auth/estado')).json()) as Json;
  assert.deepEqual(j.data, { configurado: false, puedeConfigurar: true });
});

test('setup rechaza datos inválidos', async () => {
  assert.equal((await post('/api/auth/setup', { ...valido, password: 'corta' })).status, 400);
  assert.equal((await post('/api/auth/setup', { ...valido, usuario: 'admin Samue C' })).status, 400);
  assert.equal((await post('/api/auth/setup', { ...valido, nombre: '' })).status, 400);
  assert.equal(contar('SELECT COUNT(*) n FROM usuarios'), 0);
});

test('setup detrás de un proxy (X-Forwarded-For) se rechaza aunque llegue por loopback', async () => {
  const res = await post('/api/auth/setup', valido, { 'x-forwarded-for': '203.0.113.9' });
  assert.equal(res.status, 403);
  const est = (await (await fetch(base + '/api/auth/estado', { headers: { 'x-forwarded-for': '203.0.113.9' } })).json()) as Json;
  assert.equal(est.data.puedeConfigurar, false);
  assert.equal(contar('SELECT COUNT(*) n FROM usuarios'), 0);
});

test('setup local crea el usuario, inicia sesión y luego se bloquea', async () => {
  const res = await post('/api/auth/setup', valido);
  assert.equal(res.status, 201);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0] ?? '';
  assert.match(setCookie, /HttpOnly/);

  const me = await fetch(base + '/api/auth/me', { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal(((await me.json()) as Json).data.usuario, 'admin');

  // ya no se puede crear otro por esta vía
  assert.equal((await post('/api/auth/setup', { ...valido, usuario: 'intruso' })).status, 409);
  const est = (await (await fetch(base + '/api/auth/estado')).json()) as Json;
  assert.deepEqual(est.data, { configurado: true, puedeConfigurar: false });

  // y el login normal funciona con esa contraseña
  assert.equal((await post('/api/auth/login', { usuario: 'ADMIN', password: valido.password })).status, 200);
  assert.equal(contar("SELECT COUNT(*) n FROM auditoria WHERE accion='SETUP_PRIMER_USUARIO'"), 1);
});

test('dos setups simultáneos crean un único usuario', async () => {
  db.prepare('DELETE FROM usuarios').run();
  const rs = await Promise.all([
    post('/api/auth/setup', { ...valido, usuario: 'uno' }),
    post('/api/auth/setup', { ...valido, usuario: 'dos' }),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  assert.equal(contar('SELECT COUNT(*) n FROM usuarios'), 1);
});
