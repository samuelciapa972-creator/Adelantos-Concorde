const express = require('express');
const { z } = require('zod');
const db = require('../db/database');
const { asyncHandler } = require('../middleware/errorHandler');
const { validarId } = require('../middleware/security');
const auth = require('../utils/auth');

// Gestión de las cuentas de conductores para la app móvil (solo administradores).
// Las cuentas de administrador se manejan con `npm run usuario`.
const router = express.Router();
router.param('id', validarId);

const Usuario = z.string().regex(/^[A-Za-z0-9._-]{3,50}$/, 'El usuario solo admite letras, números, punto, guion y guion bajo (3 a 50 caracteres)');
const Password = z.string().min(auth.PASSWORD_MIN, `La contraseña debe tener al menos ${auth.PASSWORD_MIN} caracteres`).max(200);

const CrearSchema = z.object({
  conductor_id: z.number().int().positive(),
  usuario: Usuario,
  password: Password,
});

// GET /api/usuarios — cuentas de conductores
router.get('/', asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.usuario, u.activo, u.debe_cambiar_password, u.creado_en,
           u.conductor_id, c.nombre AS conductor_nombre,
           (SELECT MAX(s.creado_en) FROM sesiones s WHERE s.usuario_id = u.id) AS ultima_sesion
    FROM usuarios u
    JOIN conductores c ON c.id = u.conductor_id
    WHERE u.rol = 'conductor'
    ORDER BY c.nombre
  `).all();
  res.json({ ok: true, data: rows });
}));

// POST /api/usuarios — crea la cuenta de un conductor (con contraseña temporal)
router.post('/', asyncHandler((req, res) => {
  const { conductor_id, usuario, password } = CrearSchema.parse(req.body);

  const conductor = db.prepare('SELECT id, nombre, activo FROM conductores WHERE id = ?').get(conductor_id);
  if (!conductor || !conductor.activo) {
    return res.status(400).json({ ok: false, error: 'El conductor no existe o está inactivo' });
  }
  if (db.prepare('SELECT 1 FROM usuarios WHERE conductor_id = ?').get(conductor_id)) {
    return res.status(409).json({ ok: false, error: 'Este conductor ya tiene una cuenta' });
  }

  const r = db.prepare(`
    INSERT INTO usuarios (usuario, nombre, password_hash, rol, conductor_id, debe_cambiar_password)
    VALUES (?, ?, ?, 'conductor', ?, 1)
  `).run(usuario, conductor.nombre, auth.hashPassword(password), conductor_id);

  res.status(201).json({ ok: true, data: { id: r.lastInsertRowid, usuario, conductor_id, conductor_nombre: conductor.nombre } });
}));

const filaConductor = (id) =>
  db.prepare("SELECT id FROM usuarios WHERE id = ? AND rol = 'conductor'").get(id);

// POST /api/usuarios/:id/password — restablece la contraseña (temporal) y cierra sus sesiones
router.post('/:id/password', asyncHandler((req, res) => {
  const { password } = z.object({ password: Password }).parse(req.body);
  if (!filaConductor(req.params.id)) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });

  db.prepare('UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1 WHERE id = ?').run(auth.hashPassword(password), req.params.id);
  auth.cerrarSesionesDeUsuario(Number(req.params.id));
  res.json({ ok: true });
}));

// PATCH /api/usuarios/:id/activo — activa o desactiva el acceso
router.patch('/:id/activo', asyncHandler((req, res) => {
  const { activo } = z.object({ activo: z.union([z.literal(0), z.literal(1)]) }).parse(req.body);
  if (!filaConductor(req.params.id)) return res.status(404).json({ ok: false, error: 'Cuenta no encontrada' });

  db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo, req.params.id);
  if (!activo) auth.cerrarSesionesDeUsuario(Number(req.params.id));
  res.json({ ok: true });
}));

module.exports = router;
