const express = require('express');
const { z } = require('zod');
const db = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validarId } = require('../middleware/security');
const { assertFormularioEditable } = require('../db/guards');

const router = express.Router();
router.param('id', validarId);

const fs = require('fs');
const path = require('path');
const RECIBOS_DIR = path.join(__dirname, '../../uploads/recibos');

function borrarSoporte(ruta) {
  if (!ruta) return;
  fs.unlink(path.join(RECIBOS_DIR, path.basename(ruta)), () => {});
}

const GastoSchema = z.object({
  formulario_id: z.number().int().positive(),
  fecha: z.string().min(1),

  tipo: z.enum([
    'combustible',
    'peaje',
    'hotel',
    'alimentacion',
    'parqueadero',
    'mantenimiento',
    'reparacion',
    'otro'
  ]),

  concepto: z.string().min(1),

  valor: z.number().positive(),

  observacion: z.string().optional().default(''),

  // Solo rutas generadas por /api/uploads (evita esquemas como javascript: en los enlaces)
  proveedor: z.string().trim().max(120).nullable().optional(),
  nit: z.string().trim().regex(/^[\d.\-\s]{6,20}$/, 'NIT inválido').nullable().optional().or(z.literal('').transform(() => null)),
  numero_documento: z.string().trim().max(40).nullable().optional(),
  soporte: z.string().regex(/^\/uploads\/recibos\/[\w.-]+$/, 'Ruta de soporte inválida').nullable().optional()
});


// ======================================
// GET TODOS
// ======================================

router.get('/', asyncHandler((req, res) => {
  const { formulario_id } = req.query;

  if (formulario_id) {
    const rows = db.prepare(`
      SELECT g.*, u.nombre AS creado_por_nombre
      FROM gastos g
      LEFT JOIN usuarios u ON u.id = g.creado_por
      WHERE g.formulario_id = ?
      ORDER BY g.fecha DESC, g.id DESC
    `).all(formulario_id);

    return res.json({
      ok: true,
      data: rows
    });
  }

  const rows = db.prepare(`
    SELECT *
    FROM vw_gastos
    ORDER BY fecha DESC
  `).all();

  res.json({
    ok: true,
    data: rows
  });
}));


// ======================================
// GET UNO
// ======================================

router.get('/:id', asyncHandler((req, res) => {
  const gasto = db.prepare(`
    SELECT *
    FROM vw_gastos
    WHERE id = ?
  `).get(req.params.id);

  if (!gasto) {
    return res.status(404).json({
      ok: false,
      error: 'Gasto no encontrado'
    });
  }

  res.json({
    ok: true,
    data: gasto
  });
}));


// ======================================
// CREAR
// ======================================

router.post('/', asyncHandler((req, res) => {
  const body = GastoSchema.parse(req.body);
  assertFormularioEditable(body.formulario_id);

  const result = db.prepare(`
    INSERT INTO gastos (
      formulario_id,
      fecha,
      tipo,
      concepto,
      valor,
      observacion,
      soporte,
      proveedor,
      nit,
      numero_documento,
      creado_por
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    body.formulario_id,
    body.fecha,
    body.tipo,
    body.concepto,
    body.valor,
    body.observacion ?? '',
    body.soporte ?? null,
    body.proveedor || null,
    body.nit || null,
    body.numero_documento || null,
    req.usuario.id
  );

  res.status(201).json({
    ok: true,
    data: {
      id: result.lastInsertRowid,
      ...body
    }
  });
}));


// ======================================
// ACTUALIZAR
// ======================================

router.put('/:id', asyncHandler((req, res) => {
  const body = GastoSchema.parse(req.body);

  const actual = db.prepare('SELECT formulario_id, soporte FROM gastos WHERE id = ?').get(req.params.id);
  if (!actual) {
    return res.status(404).json({ ok: false, error: 'Gasto no encontrado' });
  }
  assertFormularioEditable(actual.formulario_id);
  assertFormularioEditable(body.formulario_id);

  db.prepare(`
    UPDATE gastos
    SET
      formulario_id = ?,
      fecha = ?,
      tipo = ?,
      concepto = ?,
      valor = ?,
      observacion = ?,
      soporte = ?,
      proveedor = ?,
      nit = ?,
      numero_documento = ?
    WHERE id = ?
  `).run(
    body.formulario_id,
    body.fecha,
    body.tipo,
    body.concepto,
    body.valor,
    body.observacion ?? '',
    body.soporte ?? null,
    body.proveedor || null,
    body.nit || null,
    body.numero_documento || null,
    req.params.id
  );

  if (actual.soporte && actual.soporte !== (body.soporte ?? null)) borrarSoporte(actual.soporte);

  res.json({
    ok: true
  });
}));


// ======================================
// ELIMINAR
// ======================================

router.delete('/:id', asyncHandler((req, res) => {
  const actual = db.prepare('SELECT formulario_id, soporte FROM gastos WHERE id = ?').get(req.params.id);
  if (!actual) {
    return res.status(404).json({ ok: false, error: 'Gasto no encontrado' });
  }
  assertFormularioEditable(actual.formulario_id);

  db.prepare(`
    DELETE FROM gastos
    WHERE id = ?
  `).run(req.params.id);
  borrarSoporte(actual.soporte);

  res.json({
    ok: true
  });
}));


module.exports = router;