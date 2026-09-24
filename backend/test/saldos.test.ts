import test from 'node:test';
import assert from 'node:assert/strict';
import type { Saldos } from '../src/types/dominio.ts';

// La base en memoria debe configurarse antes de cargarla: por eso los imports dinámicos.
process.env.DB_PATH = ':memory:';

const { default: db } = await import('../src/db/database.ts');
const { SALDOS_COLUMNS, TOTAL_FACTURAS_ESCALAR } = await import('../src/db/saldos.ts');
const { assertMesAbierto, assertFormularioEditable } = await import('../src/db/guards.ts');

type Id = number | bigint;

// ── Datos base: 1 bus con titular y relevador, 1 mes ─────────────────────────
const cuenta   = db.prepare("INSERT INTO cuentas (codigo, nombre) VALUES ('1','C1')").run().lastInsertRowid;
const vehiculo = db.prepare("INSERT INTO vehiculos (numero_interno, placa, cuenta_id) VALUES ('1','AAA-111',?)").run(cuenta).lastInsertRowid;
const titular  = db.prepare("INSERT INTO conductores (nombre, iniciales, tipo) VALUES ('Titular','TT','titular')").run().lastInsertRowid;
const relevo   = db.prepare("INSERT INTO conductores (nombre, iniciales, tipo) VALUES ('Relevo','RR','relevador')").run().lastInsertRowid;
const mes      = db.prepare("INSERT INTO meses (nombre, anio) VALUES ('Enero', 2026)").run().lastInsertRowid;
db.prepare("INSERT INTO vehiculo_conductor VALUES (?,?,'titular')").run(vehiculo, titular);
db.prepare("INSERT INTO vehiculo_conductor VALUES (?,?,'relevador')").run(vehiculo, relevo);

interface Montos { anticipo: number; tasa_uso?: number; hospedaje?: number; mantenimiento?: number }

const nuevoFormulario = (n: string, conductor: Id, { anticipo, tasa_uso = 0, hospedaje = 0, mantenimiento = 0 }: Montos) =>
  db.prepare(`
    INSERT INTO formularios (numero, fecha_dia, conductor_id, vehiculo_id, mes_id, anticipo, tasa_uso, hospedaje, mantenimiento)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
  `).run(n, conductor, vehiculo, mes, anticipo, tasa_uso, hospedaje, mantenimiento).lastInsertRowid;

const gasto = (formulario: Id, valor: number) =>
  db.prepare("INSERT INTO gastos (formulario_id, fecha, tipo, concepto, valor) VALUES (?, '2026-01-01', 'peaje', 'x', ?)").run(formulario, valor);

const porFormulario = () => db.prepare(`
  SELECT f.numero, ${SALDOS_COLUMNS}
  FROM formularios f
  LEFT JOIN vehiculo_conductor vct ON vct.vehiculo_id = f.vehiculo_id AND vct.rol = 'titular'
  LEFT JOIN conductores ct ON ct.id = vct.conductor_id
  LEFT JOIN vehiculo_conductor vcr ON vcr.vehiculo_id = f.vehiculo_id AND vcr.rol = 'relevador'
  LEFT JOIN conductores cr ON cr.id = vcr.conductor_id
  LEFT JOIN gastos g ON g.formulario_id = f.id
  GROUP BY f.id ORDER BY f.id
`).all() as (Saldos & { numero: string })[];

const resumenVehiculo = () => db.prepare(`
  SELECT COALESCE(SUM(${TOTAL_FACTURAS_ESCALAR}), 0) AS total_facturas,
         COALESCE(SUM(f.anticipo - ${TOTAL_FACTURAS_ESCALAR}), 0) AS saldo_real
  FROM formularios f WHERE f.vehiculo_id = ? AND f.mes_id = ?
`).get(vehiculo, mes) as Pick<Saldos, 'total_facturas' | 'saldo_real'>;

// F1: titular, sobró dinero  → anticipo 100, facturas 30+10+20+15 = 75 → sobran 25
const f1 = nuevoFormulario('F1', titular, { anticipo: 100, tasa_uso: 30, hospedaje: 10, mantenimiento: 20 });
gasto(f1, 10); gasto(f1, 5);
// F2: relevador, gastó de más → anticipo 50, facturas 80 → empresa debe 30 al relevador
const f2 = nuevoFormulario('F2', relevo, { anticipo: 50, tasa_uso: 80 });

test('total_facturas incluye tasa_uso, hospedaje, mantenimiento y gastos', () => {
  const [r1] = porFormulario();
  assert.equal(r1?.total_facturas, 75);
  assert.equal(r1?.saldo_real, 25);
});

test('titular con saldo positivo: a favor de la empresa', () => {
  const [r1] = porFormulario();
  assert.equal(r1?.saldo_empresa, 25);
  assert.equal(r1?.saldo_conductor, 0);
  assert.equal(r1?.saldo_empresa_relevador, 0);
});

test('relevador con gastos > anticipo: a favor del relevador', () => {
  const r2 = porFormulario()[1];
  assert.equal(r2?.saldo_real, -30);
  assert.equal(r2?.saldo_relevador, 30);
  assert.equal(r2?.saldo_empresa_relevador, 0);
  assert.equal(r2?.saldo_empresa, 0);
});

test('el resumen mensual coincide con la suma de los formularios (regresión hospedaje/mantenimiento)', () => {
  const filas = porFormulario();
  const r = resumenVehiculo();
  assert.equal(r.total_facturas, filas.reduce((s, x) => s + x.total_facturas, 0));
  assert.equal(r.saldo_real, filas.reduce((s, x) => s + x.saldo_real, 0));
  assert.equal(r.total_facturas, 155);
});

test('un vehículo no admite dos titulares', () => {
  assert.throws(
    () => db.prepare("INSERT INTO vehiculo_conductor VALUES (?,?,'titular')").run(vehiculo, relevo),
    /UNIQUE/
  );
});

test('mes cerrado bloquea cambios; reabierto los permite', () => {
  assert.doesNotThrow(() => assertMesAbierto(Number(mes)));
  db.prepare('UPDATE meses SET cerrado = 1 WHERE id = ?').run(mes);
  assert.throws(() => assertMesAbierto(Number(mes)), { status: 409 });
  assert.throws(() => assertFormularioEditable(Number(f2)), { status: 409 });
  db.prepare('UPDATE meses SET cerrado = 0 WHERE id = ?').run(mes);
  assert.doesNotThrow(() => assertFormularioEditable(Number(f2)));
});

test('mes o formulario inexistente devuelve 404', () => {
  assert.throws(() => assertMesAbierto(9999), { status: 404 });
  assert.throws(() => assertFormularioEditable(9999), { status: 404 });
});
