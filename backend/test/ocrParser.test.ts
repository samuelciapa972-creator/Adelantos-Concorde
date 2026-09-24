import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerDatos, parseMonto } from '../src/utils/ocrParser.ts';

const HOY = new Date(2026, 4, 20); // 20-may-2026

test('parseMonto: formatos colombianos y de OCR', () => {
  assert.equal(parseMonto('$ 332.800'), 332800);
  assert.equal(parseMonto('332,800'), 332800);
  assert.equal(parseMonto('$1.234.567'), 1234567);
  assert.equal(parseMonto('332.800,00'), 332800);
  assert.equal(parseMonto('332,800.00'), 332800);
  assert.equal(parseMonto('18100'), 18100);
  assert.equal(parseMonto('$ 42 500'), 42500);
  assert.equal(parseMonto('abc'), null);
});

test('combustible: estación de servicio con total, subtotal, efectivo y cambio', () => {
  const r = extraerDatos(`ESTACION DE SERVICIO EL PORVENIR
TERPEL S.A. NIT 890.900.608-9
AV CARACAS 45-12 BOGOTA
FACTURA DE VENTA No. FE-208841
Fecha: 14/05/2026 Hora: 16:42
DIESEL CORRIENTE ACPM
Cantidad: 32.500 GAL
Precio: $ 10.240
Subtotal $ 332.800
IVA 0% $ 0
TOTAL A PAGAR: $ 332.800
Efectivo $ 340.000
Cambio $ 7.200
GRACIAS POR SU VISITA`, HOY);
  assert.equal(r.valor, 332800, 'no debe confundir el efectivo entregado con el total');
  assert.equal(r.fecha, '2026-05-14');
  assert.equal(r.tipo, 'combustible');
  assert.equal(r.nit, '890900608-9');
  assert.equal(r.numero_documento, 'FE-208841');
  assert.match(r.proveedor ?? '', /TERPEL/);
  assert.equal(r.confianza.valor, 'alta');
  assert.equal(r.confianza.fecha, 'alta');
});

test('restaurante: propina no es el total; fecha con guiones', () => {
  const r = extraerDatos(`RESTAURANTE LA PARADA DEL VIAJERO
NIT: 900123456-7
VIA BOGOTA - TUNJA KM 60
Factura: POS 00931
Fecha 15-05-2026
2 ALMUERZO EJECUTIVO $ 32.000
1 JUGO NATURAL $ 6.000
1 GASEOSA $ 4.500
Propina sugerida $ 4.250
VALOR TOTAL $ 42.500`, HOY);
  assert.equal(r.valor, 42500);
  assert.equal(r.fecha, '2026-05-15');
  assert.equal(r.tipo, 'alimentacion');
  assert.equal(r.nit, '900123456-7');
  assert.equal(r.numero_documento, 'POS 00931');
  assert.match(r.proveedor ?? '', /RESTAURANTE/);
});

test('peaje: usa la tarifa, fecha año/mes/día, ignora línea suelta de ruido', () => {
  const r = extraerDatos(`E
CONCESION AUTOPISTA BOGOTA
PEAJE EL ROBLE
Categoria: IV
Fecha: 2026/05/16 08:15
Tarifa: $ 18.100
Recibo No 0045219
INVIAS - Tarifa Especial`, HOY);
  assert.equal(r.valor, 18100);
  assert.equal(r.fecha, '2026-05-16');
  assert.equal(r.tipo, 'peaje');
  assert.equal(r.numero_documento, '0045219');
  assert.match(r.proveedor ?? '', /CONCESION/);
});

test('OCR con errores: O por 0, S por $, total en la línea siguiente, mes en letras', () => {
  const r = extraerDatos(`HOTEL EL DESCANSO S.A.S
N.I.T. 800.555.123 - 4
15 mayo 2026
2 NOCHES HABITACION SENCILLA
TOTAL
S 1OO.OOO`, HOY);
  assert.equal(r.valor, 100000);
  assert.equal(r.fecha, '2026-05-15');
  assert.equal(r.tipo, 'hotel');
  assert.equal(r.nit, '800555123-4');
});

test('sin palabra clave: toma el mayor importe con confianza baja', () => {
  const r = extraerDatos(`PARQUEADERO CENTRAL
Hora entrada 10:00
$ 8.000
$ 2.000`, HOY);
  assert.equal(r.valor, 8000);
  assert.equal(r.confianza.valor, 'baja');
  assert.equal(r.tipo, 'parqueadero');
});

test('fechas: dd/mm, año de 2 dígitos, y se rechazan futuras o imposibles', () => {
  assert.equal(extraerDatos('Fecha 03/05/26\nTOTAL $ 10.000', HOY).fecha, '2026-05-03');
  assert.equal(extraerDatos('Fecha 31/02/2026\nTOTAL $ 10.000', HOY).fecha, null);
  assert.equal(extraerDatos('Fecha 25/12/2026\nTOTAL $ 10.000', HOY).fecha, null);
  assert.equal(extraerDatos('Fecha 14/05/2019\nTOTAL $ 10.000', HOY).fecha, null);
});

test('texto vacío o basura no rompe y no inventa datos', () => {
  for (const t of ['', '   \n  ', '@@## ~~ ..', null, undefined]) {
    const r = extraerDatos(t, HOY);
    assert.equal(r.valor, null);
    assert.equal(r.fecha, null);
    assert.equal(r.nit, null);
    assert.equal(r.tipo, 'otro');
  }
});

test('un número de teléfono o de resolución no se toma como total', () => {
  const r = extraerDatos(`TALLER LOS AMIGOS
Tel 3105551234
Resolucion DIAN 18764001234567
TOTAL $ 85.000`, HOY);
  assert.equal(r.valor, 85000);
});
