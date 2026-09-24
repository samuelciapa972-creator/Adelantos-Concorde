import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';

// La base en memoria debe configurarse antes de cargarla: por eso los imports dinámicos.
process.env.DB_PATH = ':memory:';

const { default: db } = await import('../src/db/database.ts');
const auth = await import('../src/utils/auth.ts');

const uid = Number(db.prepare("INSERT INTO usuarios (usuario, nombre, password_hash) VALUES ('ana','Ana',?)")
  .run(auth.hashPassword('clave-segura-1')).lastInsertRowid);

test('hash: verifica la contraseña correcta y rechaza la incorrecta', () => {
  const h = auth.hashPassword('abc12345');
  assert.notEqual(h, auth.hashPassword('abc12345')); // sal distinta
  assert.ok(auth.verificarPassword('abc12345', h));
  assert.ok(!auth.verificarPassword('otra', h));
  assert.ok(!auth.verificarPassword('x', 'basura'));
});

test('sesión: token válido identifica al usuario; se guarda solo el hash', () => {
  const token = auth.crearSesion(uid);
  assert.equal(auth.usuarioDeToken(token)?.usuario, 'ana');
  const filas = db.prepare('SELECT token_hash FROM sesiones').all() as { token_hash: string }[];
  assert.ok(filas.every(f => f.token_hash !== token));
});

test('sesión: token falso, cerrado, vencido o de usuario inactivo no valen', () => {
  assert.equal(auth.usuarioDeToken('falso'), null);
  assert.equal(auth.usuarioDeToken(null), null);

  const t1 = auth.crearSesion(uid);
  auth.cerrarSesion(t1);
  assert.equal(auth.usuarioDeToken(t1), null);

  const t2 = auth.crearSesion(uid);
  db.prepare("UPDATE sesiones SET expira_en = datetime('now','-1 minute')").run();
  assert.equal(auth.usuarioDeToken(t2), null);

  const t3 = auth.crearSesion(uid);
  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(uid);
  assert.equal(auth.usuarioDeToken(t3), null);
  db.prepare('UPDATE usuarios SET activo = 1 WHERE id = ?').run(uid);
});

test('leerToken extrae la cookie sid entre otras', () => {
  const peticion = (headers: Request['headers']) => ({ headers }) as Request;
  assert.equal(auth.leerToken(peticion({ cookie: 'a=1; sid=abc123; b=2' })), 'abc123');
  assert.equal(auth.leerToken(peticion({})), null);
});
