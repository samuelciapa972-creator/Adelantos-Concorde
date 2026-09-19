const express = require('express');
const { z }   = require('zod');
const db      = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validarId } = require('../middleware/security');

const router = express.Router();
router.param('id', validarId);

const CuentaSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(100),
});

// GET /api/cuentas
router.get('/', asyncHandler((req, res) => {
  const rows = db.prepare('SELECT * FROM cuentas ORDER BY codigo').all();
  res.json({ ok: true, data: rows });
}));

// POST /api/cuentas
router.post('/', asyncHandler((req, res) => {
  const body = CuentaSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO cuentas (codigo, nombre) VALUES (?, ?)'
  ).run(body.codigo, body.nombre);
  res.status(201).json({ ok: true, data: { id: result.lastInsertRowid, ...body } });
}));

// PUT /api/cuentas/:id
router.put('/:id', asyncHandler((req, res) => {
  const body = CuentaSchema.parse(req.body);
  db.prepare('UPDATE cuentas SET codigo = ?, nombre = ? WHERE id = ?')
    .run(body.codigo, body.nombre, req.params.id);
  res.json({ ok: true });
}));

module.exports = router;
