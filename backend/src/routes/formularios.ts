import express from 'express';
import { z } from 'zod';
import db from '../db/database.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { validarId } from '../middleware/security.ts';
import { SALDOS_COLUMNS } from '../db/saldos.ts';
import { assertMesAbierto, assertFormularioEditable } from '../db/guards.ts';
import { borrarSoporte } from '../utils/archivos.ts';

const router = express.Router();
router.param('id', validarId);

const EstadoEnum = z.enum([
  'legalizado',
  'pendiente',
  'sin_legalizar',
]);

const FechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)').nullable().optional();

const FormularioSchema = z.object({
  numero:        z.string().min(1).max(50),
  fecha_dia:     z.number().int().min(1).max(31),
  conductor_id:  z.number().int().positive(),
  vehiculo_id:   z.number().int().positive(),
  mes_id:        z.number().int().positive(),
  fecha_salida:  FechaISO,
  fecha_regreso: FechaISO,
  anticipo:      z.number().nonnegative(),
  tasa_uso:      z.number().nonnegative().optional().default(0),
  hospedaje:     z.number().nonnegative().optional().default(0),  // ← nuevo
  mantenimiento: z.number().nonnegative().optional().default(0),  // ← nuevo
  ruta:          z.string().max(200).optional().default(''),
  estado:        EstadoEnum.optional().default('sin_legalizar'),
  notas:         z.string().max(500).optional().default(''),
}).refine(
  (b) => !b.fecha_salida || !b.fecha_regreso || b.fecha_regreso >= b.fecha_salida,
  { message: 'La fecha de regreso no puede ser anterior a la de salida', path: ['fecha_regreso'] }
);

const BASE_SELECT = `
  SELECT
    f.*,

    c.nombre    AS conductor_nombre,
    c.iniciales AS conductor_iniciales,

    -- Titular del vehículo
    ct.nombre AS titular_nombre,
    -- Relevador del vehículo
    cr.nombre AS relevador_nombre,

    v.numero_interno,
    v.placa,

    m.nombre AS mes_nombre,
    m.anio   AS mes_anio,

    ${SALDOS_COLUMNS}

  FROM formularios f

  INNER JOIN conductores c ON c.id = f.conductor_id
  INNER JOIN vehiculos   v ON v.id = f.vehiculo_id
  INNER JOIN meses       m ON m.id = f.mes_id

  -- Titular y relevador del vehículo
  LEFT JOIN vehiculo_conductor vct ON vct.vehiculo_id = f.vehiculo_id AND vct.rol = 'titular'
  LEFT JOIN conductores ct ON ct.id = vct.conductor_id
  LEFT JOIN vehiculo_conductor vcr ON vcr.vehiculo_id = f.vehiculo_id AND vcr.rol = 'relevador'
  LEFT JOIN conductores cr ON cr.id = vcr.conductor_id

  LEFT JOIN gastos g ON g.formulario_id = f.id
`

// GET /api/formularios
router.get('/', asyncHandler((req, res) => {
  const { mes_id, conductor_id, vehiculo_id, estado } = req.query;

  const wheres: string[] = [];
  const params: unknown[] = [];

  if (mes_id)       { wheres.push('f.mes_id = ?');       params.push(mes_id); }
  if (conductor_id) { wheres.push('f.conductor_id = ?'); params.push(conductor_id); }
  if (vehiculo_id)  { wheres.push('f.vehiculo_id = ?');  params.push(vehiculo_id); }
  if (estado)       { wheres.push('f.estado = ?');       params.push(estado); }

  const where = wheres.length > 0 ? `WHERE ${wheres.join(' AND ')}` : '';

  const rows = db.prepare(`
    ${BASE_SELECT}
    ${where}
    GROUP BY f.id
    ORDER BY f.fecha_dia, f.id
  `).all(...params);

  res.json({ ok: true, data: rows });
}));

// GET /api/formularios/:id
router.get('/:id', asyncHandler((req, res) => {
  const row = db.prepare(`
    ${BASE_SELECT}
    WHERE f.id = ?
    GROUP BY f.id
  `).get(req.params.id);

  if (!row) return res.status(404).json({ ok: false, error: 'Formulario no encontrado' });

  res.json({ ok: true, data: row });
}));

// POST /api/formularios
router.post('/', asyncHandler((req, res) => {
  const body = FormularioSchema.parse(req.body);
  assertMesAbierto(body.mes_id);

  const result = db.prepare(`
  INSERT INTO formularios (
    numero, fecha_dia, conductor_id, vehiculo_id, mes_id,
    fecha_salida, fecha_regreso, anticipo, tasa_uso, hospedaje, mantenimiento,
    ruta, estado, notas
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  body.numero, body.fecha_dia, body.conductor_id, body.vehiculo_id, body.mes_id,
  body.fecha_salida ?? null, body.fecha_regreso ?? null,
  body.anticipo, body.tasa_uso, body.hospedaje, body.mantenimiento,
  body.ruta, body.estado, body.notas
);

  const nuevo = db.prepare(`${BASE_SELECT} WHERE f.id = ? GROUP BY f.id`).get(result.lastInsertRowid);
  res.status(201).json({ ok: true, data: nuevo });
}));

// PUT /api/formularios/:id
router.put('/:id', asyncHandler((req, res) => {
  const body = FormularioSchema.parse(req.body);
  assertFormularioEditable(req.params.id);
  assertMesAbierto(body.mes_id);

 db.prepare(`
  UPDATE formularios SET
    numero = ?, fecha_dia = ?, conductor_id = ?, vehiculo_id = ?, mes_id = ?,
    fecha_salida = ?, fecha_regreso = ?, anticipo = ?, tasa_uso = ?,
    hospedaje = ?, mantenimiento = ?, ruta = ?, estado = ?, notas = ?,
    actualizado = datetime('now')
  WHERE id = ?
`).run(
  body.numero, body.fecha_dia, body.conductor_id, body.vehiculo_id, body.mes_id,
  body.fecha_salida ?? null, body.fecha_regreso ?? null,
  body.anticipo, body.tasa_uso, body.hospedaje, body.mantenimiento,
  body.ruta, body.estado, body.notas,
  req.params.id
);

  const updated = db.prepare(`${BASE_SELECT} WHERE f.id = ? GROUP BY f.id`).get(req.params.id);
  res.json({ ok: true, data: updated });
}));

// PATCH /api/formularios/:id/legalizar
router.patch('/:id/legalizar', asyncHandler((req, res) => {
  assertFormularioEditable(req.params.id);

  db.prepare(`
    UPDATE formularios SET estado = 'legalizado', actualizado = datetime('now') WHERE id = ?
  `).run(req.params.id);

  res.json({ ok: true });
}));

// DELETE /api/formularios/:id
router.delete('/:id', asyncHandler((req, res) => {
  assertFormularioEditable(req.params.id);

  // Los gastos se borran en cascada: se guardan sus soportes para limpiar los archivos
  const soportes = db.prepare('SELECT soporte FROM gastos WHERE formulario_id = ? AND soporte IS NOT NULL')
    .all(req.params.id) as { soporte: string }[];

  const info = db.prepare('DELETE FROM formularios WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ ok: false, error: 'Formulario no encontrado' });

  soportes.forEach(({ soporte }) => borrarSoporte(soporte));
  res.json({ ok: true });
}));


export default router;
