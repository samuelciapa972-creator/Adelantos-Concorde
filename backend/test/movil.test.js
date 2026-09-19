process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const db = require('../src/db/database');
const auth = require('../src/utils/auth');
const app = require('../src/index');
const { cerrarOcr } = require('../src/utils/ocr');

const ADMIN_PASS = 'clave-admin-12345';
const TEMP_PASS = 'clave-temporal-123';
const NUEVA_PASS = 'clave-definitiva-456';

let base, server;
const cookies = { admin: '', ana: '', beto: '' };

async function api(quien, metodo, ruta, body, extra = {}) {
  const res = await fetch(base + ruta, {
    method: metodo,
    headers: { ...(body && !extra.raw ? { 'content-type': 'application/json' } : {}), ...(cookies[quien] ? { cookie: cookies[quien] } : {}) },
    body: extra.raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const t = await res.text();
  let json = null; try { json = JSON.parse(t); } catch {}
  return { status: res.status, json, res, texto: t };
}

async function login(quien, usuario, password) {
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario, password }) });
  const j = await res.json();
  if (res.status === 200) cookies[quien] = res.headers.get('set-cookie').split(';')[0];
  return { status: res.status, data: j.data };
}

// Soporte sintético: tiquete de estación de servicio
async function fotoTiquete(total = '332.800', nit = '890.900.608-9', factura = 'FE-208841') {
  const lineas = [
    'TERPEL S.A.  NIT ' + nit, 'ESTACION DE SERVICIO EL PORVENIR', 'FACTURA DE VENTA No. ' + factura,
    'Fecha: 14/05/2026  Hora: 16:42', 'DIESEL CORRIENTE ACPM', 'Cantidad: 32.500 GAL', 'Subtotal      $ ' + total,
    'TOTAL A PAGAR: $ ' + total, 'Efectivo      $ 340.000',
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="${60 + lineas.length * 26}"><rect width="100%" height="100%" fill="#f4f1e8"/>` +
    lineas.map((l, i) => `<text x="16" y="${40 + i * 26}" font-family="DejaVu Sans Mono" font-size="17" fill="#222">${l}</text>`).join('') + '</svg>';
  return sharp(Buffer.from(svg)).flatten({ background: '#f4f1e8' }).jpeg({ quality: 85 }).toBuffer();
}

async function subirFoto(quien, buffer, nombre = 'foto.jpg', tipo = 'image/jpeg') {
  const fd = new FormData();
  fd.append('foto', new Blob([buffer], { type: tipo }), nombre);
  const res = await fetch(base + '/api/movil/analizar', { method: 'POST', headers: { cookie: cookies[quien] }, body: fd });
  return { status: res.status, json: await res.json() };
}

let anaConductor, betoConductor, mesId, mesCerradoId, fAna, fBeto, fAnaCerrado, fAnaLegalizado;

test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;

  db.prepare("INSERT INTO usuarios (usuario, nombre, password_hash) VALUES ('admin','Admin',?)").run(auth.hashPassword(ADMIN_PASS));
  await login('admin', 'admin', ADMIN_PASS);

  const cuenta = db.prepare("INSERT INTO cuentas (codigo, nombre) VALUES ('1','C1')").run().lastInsertRowid;
  const veh = db.prepare("INSERT INTO vehiculos (numero_interno, placa, cuenta_id) VALUES ('33000','ABC-123',?)").run(cuenta).lastInsertRowid;
  anaConductor = db.prepare("INSERT INTO conductores (nombre, iniciales) VALUES ('Ana Gómez','AG')").run().lastInsertRowid;
  betoConductor = db.prepare("INSERT INTO conductores (nombre, iniciales) VALUES ('Beto Ruiz','BR')").run().lastInsertRowid;
  mesId = db.prepare("INSERT INTO meses (nombre, anio) VALUES ('Mayo', 2026)").run().lastInsertRowid;
  mesCerradoId = db.prepare("INSERT INTO meses (nombre, anio, cerrado) VALUES ('Abril', 2026, 1)").run().lastInsertRowid;
  const nf = (n, c, mes, estado = 'sin_legalizar') => db.prepare(
    'INSERT INTO formularios (numero, fecha_dia, conductor_id, vehiculo_id, mes_id, anticipo, tasa_uso, estado) VALUES (?,?,?,?,?,?,?,?)'
  ).run(n, 3, c, veh, mes, 200000, 50000, estado).lastInsertRowid;
  fAna = nf('A1', anaConductor, mesId);
  fBeto = nf('B1', betoConductor, mesId);
  fAnaCerrado = nf('A0', anaConductor, mesCerradoId);
  fAnaLegalizado = nf('A2', anaConductor, mesId, 'legalizado');
});

test.after(async () => {
  server.close();
  await cerrarOcr();
  for (const { nombre } of db.prepare('SELECT nombre FROM archivos').all()) {
    fs.rmSync(path.join(__dirname, '../uploads/recibos', nombre), { force: true });
  }
});

test('el administrador crea cuentas de conductor; una segunda para el mismo conductor se rechaza', async () => {
  const r = await api('admin', 'POST', '/api/usuarios', { conductor_id: anaConductor, usuario: 'ana', password: TEMP_PASS });
  assert.equal(r.status, 201);
  assert.equal((await api('admin', 'POST', '/api/usuarios', { conductor_id: betoConductor, usuario: 'beto', password: TEMP_PASS })).status, 201);
  assert.equal((await api('admin', 'POST', '/api/usuarios', { conductor_id: anaConductor, usuario: 'ana2', password: TEMP_PASS })).status, 409);
  assert.equal((await api('admin', 'POST', '/api/usuarios', { conductor_id: betoConductor, usuario: 'x y', password: TEMP_PASS })).status, 400);
  assert.equal((await api('admin', 'POST', '/api/usuarios', { conductor_id: betoConductor, usuario: 'corta', password: 'corta' })).status, 400);
  const lista = (await api('admin', 'GET', '/api/usuarios')).json.data;
  assert.equal(lista.length, 2);
  assert.ok(lista.every((u) => u.debe_cambiar_password === 1 && !('password_hash' in u)));
});

test('contraseña temporal: el conductor debe cambiarla antes de usar cualquier otra cosa', async () => {
  const l = await login('ana', 'ana', TEMP_PASS);
  assert.equal(l.status, 200);
  assert.equal(l.data.rol, 'conductor');
  assert.equal(l.data.debe_cambiar_password, true);

  const bloqueado = await api('ana', 'GET', '/api/movil/formularios');
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.json.codigo, 'CAMBIAR_PASSWORD');

  assert.equal((await api('ana', 'POST', '/api/auth/password', { actual: TEMP_PASS, nueva: NUEVA_PASS })).status, 200);
  assert.equal((await api('ana', 'GET', '/api/movil/formularios')).status, 200);

  await login('beto', 'beto', TEMP_PASS);
  await api('beto', 'POST', '/api/auth/password', { actual: TEMP_PASS, nueva: NUEVA_PASS });
});

test('un conductor NO accede al panel de administración ni a datos ajenos', async () => {
  for (const ruta of ['/api/formularios', '/api/conductores', '/api/vehiculos', '/api/meses', '/api/usuarios', '/api/gastos', '/api/cuentas', '/api/reportes/pdf/1']) {
    assert.equal((await api('ana', 'GET', ruta)).status, 403, ruta);
  }
  assert.equal((await api('ana', 'POST', '/api/meses', { nombre: 'Enero', anio: 2026 })).status, 403);
  assert.equal((await api('ana', 'DELETE', `/api/formularios/${fAna}`)).status, 403);
  assert.equal((await api('ana', 'POST', '/api/usuarios', { conductor_id: betoConductor, usuario: 'zzz', password: TEMP_PASS })).status, 403);
  // y el administrador no usa la API móvil
  assert.equal((await api('admin', 'GET', '/api/movil/formularios')).status, 403);
});

test('cada conductor ve solo sus formularios y gastos', async () => {
  const propios = (await api('ana', 'GET', '/api/movil/formularios')).json.data;
  assert.deepEqual(propios.map((f) => f.numero).sort(), ['A0', 'A1', 'A2']);
  assert.equal(propios.find((f) => f.numero === 'A1').editable, true);
  assert.equal(propios.find((f) => f.numero === 'A0').editable, false, 'mes cerrado');
  assert.equal(propios.find((f) => f.numero === 'A2').editable, false, 'ya legalizado');
  assert.equal(propios.find((f) => f.numero === 'A1').saldo_real, 150000);

  assert.equal((await api('ana', 'GET', `/api/movil/formularios/${fBeto}/gastos`)).status, 404);
  assert.equal((await api('beto', 'GET', `/api/movil/formularios/${fAna}/gastos`)).status, 404);
});

let ruta1, extraido1;
test('analizar: la foto se guarda y se extraen valor, fecha, tipo, NIT, proveedor y factura', async () => {
  const r = await subirFoto('ana', await fotoTiquete());
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const d = r.json.data;
  assert.equal(d.ocr.ok, true);
  assert.equal(d.extraido.valor, 332800);
  assert.equal(d.extraido.fecha, '2026-05-14');
  assert.equal(d.extraido.tipo, 'combustible');
  assert.equal(d.extraido.nit, '890900608-9');
  assert.equal(d.extraido.numero_documento, 'FE-208841');
  assert.match(d.extraido.proveedor, /TERPEL/);
  assert.match(d.archivo, /^\/uploads\/recibos\/[\w.-]+\.jpg$/);
  ruta1 = d.archivo; extraido1 = d.extraido;
});

test('analizar rechaza archivos falsos y un conductor ve solo sus propias fotos', async () => {
  assert.equal((await subirFoto('ana', Buffer.from('<script>alert(1)</script>'), 'x.jpg')).status, 400);
  assert.equal((await subirFoto('ana', Buffer.from('%PDF-1.4 nada'), 'x.pdf', 'application/pdf')).json.data.advertencia.includes('PDF'), true);

  assert.equal((await fetch(base + ruta1, { headers: { cookie: cookies.ana } })).status, 200, 'su propia foto');
  assert.equal((await fetch(base + ruta1, { headers: { cookie: cookies.beto } })).status, 404, 'foto de otro conductor');
  assert.equal((await fetch(base + ruta1, { headers: { cookie: cookies.admin } })).status, 200, 'el administrador ve todas');
  assert.equal((await fetch(base + ruta1)).status, 401, 'sin sesión');
});

let gastoId;
test('crear gasto desde la foto: se guarda con origen app_movil y datos del soporte', async () => {
  const cuerpo = { formulario_id: fAna, fecha: '2026-05-14', tipo: 'combustible', concepto: 'Tanqueo Terpel', valor: 332800,
    proveedor: extraido1.proveedor, nit: extraido1.nit, numero_documento: extraido1.numero_documento, soporte: ruta1, ocr_confianza: 94 };
  const r = await api('ana', 'POST', '/api/movil/gastos', cuerpo);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  gastoId = r.json.data.id;

  const fila = db.prepare('SELECT origen, creado_por, nit, numero_documento FROM gastos WHERE id = ?').get(gastoId);
  assert.equal(fila.origen, 'app_movil');
  assert.equal(fila.nit, '890900608-9');

  // la foto no se puede reutilizar
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...cuerpo, valor: 1000 })).status, 409);
  // el administrador lo ve, con quién lo subió
  const admin = (await api('admin', 'GET', `/api/gastos?formulario_id=${fAna}`)).json.data;
  assert.equal(admin[0].creado_por_nombre, 'Ana Gómez');
  assert.equal(admin[0].origen, 'app_movil');
});

test('validaciones del gasto móvil', async () => {
  const foto = (await subirFoto('ana', await fotoTiquete('50.000', '900.111.222-3', 'FE-1'))).json.data.archivo;
  const ok = { formulario_id: fAna, fecha: '2026-05-14', tipo: 'peaje', concepto: 'Peaje', valor: 50000, soporte: foto };
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, valor: -5 })).status, 400);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, valor: 1.5 })).status, 400);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, fecha: '2099-01-01' })).status, 400);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, tipo: 'lujos' })).status, 400);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, soporte: 'javascript:alert(1)' })).status, 400);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, soporte: '/uploads/recibos/../../etc/passwd' })).status, 400);
  // una foto subida por OTRO conductor no vale
  assert.equal((await api('beto', 'POST', '/api/movil/gastos', { ...ok, formulario_id: fBeto })).status, 400);
  // formulario ajeno, mes cerrado, legalizado
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, formulario_id: fBeto })).status, 404);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, formulario_id: fAnaCerrado })).status, 409);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...ok, formulario_id: fAnaLegalizado })).status, 409);
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', ok)).status, 201);
});

test('factura duplicada (mismo NIT y número): avisa y permite confirmar', async () => {
  const foto = (await subirFoto('ana', await fotoTiquete())).json.data.archivo;
  const cuerpo = { formulario_id: fAna, fecha: '2026-05-14', tipo: 'combustible', concepto: 'Tanqueo', valor: 332800,
    nit: '890900608-9', numero_documento: 'FE-208841', soporte: foto };
  const r = await api('ana', 'POST', '/api/movil/gastos', cuerpo);
  assert.equal(r.status, 409);
  assert.equal(r.json.codigo, 'POSIBLE_DUPLICADO');
  assert.equal((await api('ana', 'POST', '/api/movil/gastos', { ...cuerpo, confirmar_duplicado: true })).status, 201);
});

test('eliminar: solo mis gastos, con el formulario abierto; se borra también la foto', async () => {
  assert.equal((await api('beto', 'DELETE', `/api/movil/gastos/${gastoId}`)).status, 404);
  const archivo = db.prepare('SELECT soporte FROM gastos WHERE id = ?').get(gastoId).soporte;
  assert.equal((await api('ana', 'DELETE', `/api/movil/gastos/${gastoId}`)).status, 200);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(fs.existsSync(path.join(__dirname, '../uploads/recibos', path.basename(archivo))), false);

  // tras legalizar, ya no se puede borrar
  const otro = db.prepare("SELECT id FROM gastos WHERE formulario_id = ? AND origen='app_movil' LIMIT 1").get(fAna).id;
  db.prepare("UPDATE formularios SET estado='legalizado' WHERE id = ?").run(fAna);
  assert.equal((await api('ana', 'DELETE', `/api/movil/gastos/${otro}`)).status, 409);
  db.prepare("UPDATE formularios SET estado='sin_legalizar' WHERE id = ?").run(fAna);
});

test('el administrador puede restablecer la contraseña y desactivar el acceso', async () => {
  const usuarioAna = db.prepare("SELECT id FROM usuarios WHERE usuario='ana'").get().id;
  assert.equal((await api('admin', 'POST', `/api/usuarios/${usuarioAna}/password`, { password: 'otra-temporal-99' })).status, 200);
  assert.equal((await api('ana', 'GET', '/api/movil/formularios')).status, 401, 'sus sesiones se cerraron');
  const l = await login('ana', 'ana', 'otra-temporal-99');
  assert.equal(l.data.debe_cambiar_password, true);

  assert.equal((await api('admin', 'PATCH', `/api/usuarios/${usuarioAna}/activo`, { activo: 0 })).status, 200);
  assert.equal((await login('ana', 'ana', 'otra-temporal-99')).status, 401, 'cuenta desactivada');

  // no se puede tocar una cuenta de administrador por esta vía
  const adminId = db.prepare("SELECT id FROM usuarios WHERE usuario='admin'").get().id;
  assert.equal((await api('admin', 'POST', `/api/usuarios/${adminId}/password`, { password: 'otra-temporal-99' })).status, 404);
  assert.equal((await api('admin', 'PATCH', `/api/usuarios/${adminId}/activo`, { activo: 0 })).status, 404);
});

test('limpieza: borra las fotos sin gasto de más de 24 h y respeta las recientes y las en uso', async () => {
  const { limpiarArchivosHuerfanos } = require('../src/utils/archivos');
  const dir = path.join(__dirname, '../uploads/recibos');
  const uid = db.prepare("SELECT id FROM usuarios WHERE usuario='admin'").get().id;
  const crear = (nombre, hace) => {
    fs.writeFileSync(path.join(dir, nombre), 'x');
    db.prepare("INSERT INTO archivos (nombre, usuario_id, creado_en) VALUES (?, ?, datetime('now', ?))").run(nombre, uid, hace);
  };
  crear('test-vieja-sin-uso.jpg', '-2 days');
  crear('test-reciente-sin-uso.jpg', '-1 hour');
  crear('test-vieja-en-uso.jpg', '-2 days');
  db.prepare("INSERT INTO gastos (formulario_id, fecha, tipo, concepto, valor, soporte) VALUES (?, '2026-05-14', 'otro', 'x', 1000, '/uploads/recibos/test-vieja-en-uso.jpg')").run(fAna);

  assert.equal(limpiarArchivosHuerfanos(), 1);
  assert.equal(fs.existsSync(path.join(dir, 'test-vieja-sin-uso.jpg')), false);
  assert.equal(fs.existsSync(path.join(dir, 'test-reciente-sin-uso.jpg')), true);
  assert.equal(fs.existsSync(path.join(dir, 'test-vieja-en-uso.jpg')), true);
  for (const n of ['test-reciente-sin-uso.jpg', 'test-vieja-en-uso.jpg']) fs.rmSync(path.join(dir, n), { force: true });
});
