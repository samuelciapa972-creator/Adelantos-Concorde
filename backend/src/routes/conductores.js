const express = require('express');
const { z } = require('zod');
const db = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validarId } = require('../middleware/security');

const router = express.Router();
router.param('id', validarId);

const iniciales = (nombre) =>
  nombre.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'XX';

const ConductorSchema = z.object({
  nombre: z.string().min(2).max(100),
  iniciales: z.string().min(1).max(5).optional(),
  licencia: z.string().optional().nullable(),
  tipo: z.enum(['titular', 'relevador']).optional(),
  activo: z.number().int().min(0).max(1).optional(),
});

// GET /api/conductores
router.get('/', asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM conductores
    ORDER BY nombre
  `).all();

  res.json({
    ok: true,
    data: rows,
  });
}));

// GET /api/conductores/:id
router.get('/:id', asyncHandler((req, res) => {
  const conductor = db.prepare(`
    SELECT *
    FROM conductores
    WHERE id = ?
  `).get(req.params.id);

  if (!conductor) {
    return res.status(404).json({
      ok: false,
      error: 'Conductor no encontrado',
    });
  }

  res.json({
    ok: true,
    data: conductor,
  });
}));

// POST /api/conductores
router.post('/', asyncHandler((req, res) => {
  const body = ConductorSchema.parse(req.body);
  body.iniciales = (body.iniciales ?? iniciales(body.nombre)).toUpperCase();

  const result = db.prepare(`
    INSERT INTO conductores (
      nombre,
      iniciales,
      licencia,
      tipo
    )
    VALUES (?, ?, ?, ?)
  `).run(
    body.nombre,
    body.iniciales,
    body.licencia ?? null,
    body.tipo ?? 'titular'
  );

  res.status(201).json({
    ok: true,
    data: {
      id: result.lastInsertRowid,
      ...body,
    },
  });
}));

// PUT /api/conductores/:id
router.put('/:id', asyncHandler((req, res) => {
  const body = ConductorSchema.partial().parse(req.body);

  if (Object.keys(body).length === 0) {
    return res.status(400).json({
      ok: false,
      error: 'No hay datos para actualizar',
    });
  }

  const sets = Object.keys(body)
    .map(key => `${key} = ?`)
    .join(', ');

  const values = [
    ...Object.values(body),
    req.params.id,
  ];

  const result = db.prepare(`
    UPDATE conductores
    SET ${sets}
    WHERE id = ?
  `).run(...values);

  if (result.changes === 0) {
    return res.status(404).json({
      ok: false,
      error: 'Conductor no encontrado',
    });
  }

  res.json({
    ok: true,
  });
}));

// DELETE /api/conductores/:id
router.delete('/:id', asyncHandler((req, res) => {
  // Al desactivar, se libera de los vehículos donde era titular o relevador.
  const result = db.transaction(() => {
    const r = db.prepare('UPDATE conductores SET activo = 0 WHERE id = ?').run(req.params.id);
    if (r.changes > 0) {
      db.prepare('DELETE FROM vehiculo_conductor WHERE conductor_id = ?').run(req.params.id);
    }
    return r;
  })();

  if (result.changes === 0) {
    return res.status(404).json({
      ok: false,
      error: 'Conductor no encontrado',
    });
  }

  res.json({
    ok: true,
  });
}));

module.exports = router;