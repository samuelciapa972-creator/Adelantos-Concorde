import express from 'express'
import { z } from 'zod'
import db from '../db/database.ts'
import { asyncHandler } from '../middleware/errorHandler.ts'
import { validarId } from '../middleware/security.ts'
import { HttpError } from '../utils/errores.ts'

const router = express.Router()
router.param('id', validarId);

const VehiculoSchema = z.object({
  numero_interno: z.string().min(1).max(20),
  placa:          z.string().min(1).max(20),
  marca:          z.string().optional().nullable(),
  modelo:         z.string().optional().nullable(),
  color:          z.string().optional().nullable(),
  cuenta_id:      z.number().int().positive().optional(),
})

const ConductoresSchema = z.object({
  titular_id:   z.number().int().positive().nullable().optional(),
  relevador_id: z.number().int().positive().nullable().optional(),
}).refine(
  (b) => !b.titular_id || b.titular_id !== b.relevador_id,
  { message: 'El titular y el relevador deben ser conductores distintos', path: ['relevador_id'] }
)

// Cada bus opera sobre su propia cuenta contable (código = número interno).
// Si no se indica una cuenta, se usa la existente con ese código o se crea.
function cuentaParaVehiculo(numeroInterno: string, cuentaId: number | undefined): number | bigint {
  if (cuentaId) {
    if (!db.prepare('SELECT 1 FROM cuentas WHERE id = ?').get(cuentaId)) {
      throw new HttpError('La cuenta indicada no existe', 400)
    }
    return cuentaId
  }
  const existente = db.prepare('SELECT id FROM cuentas WHERE codigo = ?').get(numeroInterno) as { id: number } | undefined
  if (existente) return existente.id
  return db.prepare('INSERT INTO cuentas (codigo, nombre) VALUES (?, ?)')
    .run(numeroInterno, `Cuenta Bus ${numeroInterno}`).lastInsertRowid
}

const BASE_SELECT = `
  SELECT
    v.*,
    cu.codigo AS cuenta_codigo,
    ct.id     AS titular_id,   ct.nombre AS titular,
    cr.id     AS relevador_id, cr.nombre AS relevador
  FROM vehiculos v
  LEFT JOIN cuentas cu ON cu.id = v.cuenta_id
  LEFT JOIN vehiculo_conductor vct ON vct.vehiculo_id = v.id AND vct.rol = 'titular'
  LEFT JOIN conductores ct ON ct.id = vct.conductor_id
  LEFT JOIN vehiculo_conductor vcr ON vcr.vehiculo_id = v.id AND vcr.rol = 'relevador'
  LEFT JOIN conductores cr ON cr.id = vcr.conductor_id
`

// GET /api/vehiculos
router.get('/', asyncHandler((req, res) => {
  const rows = db.prepare(`
    ${BASE_SELECT}
    WHERE v.activo = 1
    ORDER BY v.numero_interno
  `).all()
  res.json({ ok: true, data: rows })
}))

// GET /api/vehiculos/:id
router.get('/:id', asyncHandler((req, res) => {
  const v = db.prepare(`${BASE_SELECT} WHERE v.id = ?`).get(req.params.id)
  if (!v) return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' })
  res.json({ ok: true, data: v })
}))

// POST /api/vehiculos
router.post('/', asyncHandler((req, res) => {
  const body = VehiculoSchema.parse(req.body)
  const result = db.transaction(() => {
    const cuentaId = cuentaParaVehiculo(body.numero_interno, body.cuenta_id)
    return db.prepare(`
      INSERT INTO vehiculos (numero_interno, placa, marca, modelo, color, cuenta_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      body.numero_interno,
      body.placa.toUpperCase(),
      body.marca   ?? null,
      body.modelo  ?? null,
      body.color   ?? null,
      cuentaId,
    )
  })()
  const nuevo = db.prepare(`${BASE_SELECT} WHERE v.id = ?`).get(result.lastInsertRowid)
  res.status(201).json({ ok: true, data: nuevo })
}))

// PUT /api/vehiculos/:id
router.put('/:id', asyncHandler((req, res) => {
  const body = VehiculoSchema.partial().parse(req.body)
  db.prepare(`
    UPDATE vehiculos SET
      numero_interno = COALESCE(?, numero_interno),
      placa          = COALESCE(?, placa),
      marca          = ?,
      modelo         = ?,
      color          = ?
    WHERE id = ?
  `).run(
    body.numero_interno ?? null,
    body.placa?.toUpperCase() ?? null,
    body.marca          ?? null,
    body.modelo         ?? null,
    body.color          ?? null,
    req.params.id,
  )
  res.json({ ok: true })
}))

// PATCH /api/vehiculos/:id/conductores
router.patch('/:id/conductores', asyncHandler((req, res) => {
  const { titular_id, relevador_id } = ConductoresSchema.parse(req.body)
  const vehiculo_id = parseInt(req.params.id ?? '')

  if (!db.prepare('SELECT 1 FROM vehiculos WHERE id = ? AND activo = 1').get(vehiculo_id)) {
    return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' })
  }
  for (const id of [titular_id, relevador_id].filter(Boolean)) {
    if (!db.prepare('SELECT 1 FROM conductores WHERE id = ? AND activo = 1').get(id)) {
      return res.status(400).json({ ok: false, error: 'El conductor indicado no existe o está inactivo' })
    }
  }

  const deleteRol = db.prepare(`
    DELETE FROM vehiculo_conductor WHERE vehiculo_id = ? AND rol = ?
  `)
  const insertRol = db.prepare(`
    INSERT INTO vehiculo_conductor (vehiculo_id, conductor_id, rol)
    VALUES (?, ?, ?)
  `)

  db.transaction(() => {
    // Un conductor solo puede estar en un rol por vehículo: se quita de donde ya estuviera.
    for (const id of [titular_id, relevador_id].filter(Boolean)) {
      db.prepare('DELETE FROM vehiculo_conductor WHERE vehiculo_id = ? AND conductor_id = ?').run(vehiculo_id, id)
    }
    if (titular_id !== undefined) {
      deleteRol.run(vehiculo_id, 'titular')
      if (titular_id) insertRol.run(vehiculo_id, titular_id, 'titular')
    }
    if (relevador_id !== undefined) {
      deleteRol.run(vehiculo_id, 'relevador')
      if (relevador_id) insertRol.run(vehiculo_id, relevador_id, 'relevador')
    }
  })()

  res.json({ ok: true })
}))

// DELETE /api/vehiculos/:id (soft delete)
router.delete('/:id', asyncHandler((req, res) => {
  const result = db.prepare('UPDATE vehiculos SET activo = 0 WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ ok: false, error: 'Vehículo no encontrado' })
  res.json({ ok: true })
}))


export default router;
