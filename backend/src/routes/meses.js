const express = require('express');
const { z }   = require('zod');
const db      = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validarId } = require('../middleware/security');
const { TOTAL_FACTURAS_ESCALAR } = require('../db/saldos');

const router = express.Router();
router.param('id', validarId);

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MesSchema = z.object({
  nombre:  z.enum(MESES),
  anio:    z.number().int().min(2020).max(2100),
  cerrado: z.number().int().min(0).max(1).optional(),
});

// GET /api/meses
router.get('/', asyncHandler((req, res) => {
  const rows = db.prepare('SELECT * FROM meses ORDER BY anio DESC, id DESC').all();
  res.json({ ok: true, data: rows });
}));

// GET /api/meses/:id — con resumen de saldos
router.get('/:id/resumen', asyncHandler((req, res) => {

  const mes = db.prepare(`
    SELECT * FROM meses WHERE id = ?
  `).get(req.params.id);

  if (!mes) {
    return res.status(404).json({ ok: false, error: 'Mes no encontrado' });
  }

  const { vehiculo_id } = req.query

  const resumen = db.prepare(`
    SELECT
      v.id             AS vehiculo_id,
      v.numero_interno AS vehiculo,
      v.placa,

      -- Titular
      ct.id     AS titular_id,
      ct.nombre AS titular,

      -- Relevador
      cr.id     AS relevador_id,
      cr.nombre AS relevador,

      COUNT(f.id) AS total_formularios,

      COALESCE(SUM(f.anticipo), 0) AS total_anticipo,

      COALESCE(SUM(${TOTAL_FACTURAS_ESCALAR}), 0) AS total_facturas,

      COALESCE(SUM(f.anticipo - ${TOTAL_FACTURAS_ESCALAR}), 0) AS saldo_real,

      SUM(CASE WHEN f.estado = 'sin_legalizar' THEN 1 ELSE 0 END) AS sin_legalizar,
      SUM(CASE WHEN f.estado = 'pendiente'     THEN 1 ELSE 0 END) AS con_pendiente,
      SUM(CASE WHEN f.estado = 'legalizado'    THEN 1 ELSE 0 END) AS legalizados

    FROM vehiculos v

    -- Titular activo
    LEFT JOIN vehiculo_conductor vct
      ON vct.vehiculo_id = v.id AND vct.rol = 'titular'
    LEFT JOIN conductores ct ON ct.id = vct.conductor_id

    -- Relevador activo
    LEFT JOIN vehiculo_conductor vcr
      ON vcr.vehiculo_id = v.id AND vcr.rol = 'relevador'
    LEFT JOIN conductores cr ON cr.id = vcr.conductor_id

    -- Formularios del mes
    LEFT JOIN formularios f
      ON f.vehiculo_id = v.id AND f.mes_id = ?

    WHERE v.activo = 1
    ${vehiculo_id ? 'AND v.id = ?' : ''}

    GROUP BY v.id
    ORDER BY v.numero_interno
  `).all(req.params.id, ...(vehiculo_id ? [vehiculo_id] : []))

  res.json({ ok: true, data: { mes, resumen } })
}));

// POST /api/meses
router.post('/', asyncHandler((req, res) => {
  const body = MesSchema.parse(req.body);
  const result = db.prepare(
    'INSERT INTO meses (nombre, anio) VALUES (?, ?)'
  ).run(body.nombre, body.anio);
  res.status(201).json({ ok: true, data: { id: result.lastInsertRowid, ...body } });
}));

// PATCH /api/meses/:id/cerrar
router.patch('/:id/cerrar', asyncHandler((req, res) => {
  const info = db.prepare('UPDATE meses SET cerrado = 1 WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'Mes no encontrado' });
  res.json({ ok: true });
}));

// PATCH /api/meses/:id/reabrir
router.patch('/:id/reabrir', asyncHandler((req, res) => {
  const info = db.prepare('UPDATE meses SET cerrado = 0 WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'Mes no encontrado' });
  res.json({ ok: true });
}));

module.exports = router;
