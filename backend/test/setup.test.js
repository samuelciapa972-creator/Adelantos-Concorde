process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db/database');
const app = require('../src/index');

let base, server;
test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (ruta, body, headers = {}) =>
  fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

const valido = { usuario: 'admin', nombre: 'Ana Admin', password: 'clave-segura-123' };

test('sin usuarios: /estado indica que hay que configurar y que es posible desde el equipo local', async () => {
  const j = await (await fetch(base + '/api/auth/estado')).json();
  assert.deepEqual(j.data, { configurado: false, puedeConfigurar: true });
});

test('setup rechaza datos inválidos', async () => {
  assert.equal((await post('/api/auth/setup', { ...valido, password: 'corta' })).status, 400);
  assert.equal((await post('/api/auth/setup', { ...valido, usuario: 'admin Samue C' })).status, 400);
  assert.equal((await post('/api/auth/setup', { ...valido, nombre: '' })).status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 0);
});

test('setup detrás de un proxy (X-Forwarded-For) se rechaza aunque llegue por loopback', async () => {
  const res = await post('/api/auth/setup', valido, { 'x-forwarded-for': '203.0.113.9' });
  assert.equal(res.status, 403);
  const est = await (await fetch(base + '/api/auth/estado', { headers: { 'x-forwarded-for': '203.0.113.9' } })).json();
  assert.equal(est.data.puedeConfigurar, false);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 0);
});

test('setup local crea el usuario, inicia sesión y luego se bloquea', async () => {
  const res = await post('/api/auth/setup', valido);
  assert.equal(res.status, 201);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  assert.match(res.headers.get('set-cookie'), /HttpOnly/);

  const me = await fetch(base + '/api/auth/me', { headers: { cookie } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).data.usuario, 'admin');

  // ya no se puede crear otro por esta vía
  assert.equal((await post('/api/auth/setup', { ...valido, usuario: 'intruso' })).status, 409);
  const est = await (await fetch(base + '/api/auth/estado')).json();
  assert.deepEqual(est.data, { configurado: true, puedeConfigurar: false });

  // y el login normal funciona con esa contraseña
  assert.equal((await post('/api/auth/login', { usuario: 'ADMIN', password: valido.password })).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM auditoria WHERE accion='SETUP_PRIMER_USUARIO'").get().n, 1);
});

test('dos setups simultáneos crean un único usuario', async () => {
  db.prepare('DELETE FROM usuarios').run();
  const rs = await Promise.all([
    post('/api/auth/setup', { ...valido, usuario: 'uno' }),
    post('/api/auth/setup', { ...valido, usuario: 'dos' }),
  ]);
  assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409]);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM usuarios').get().n, 1);
});
