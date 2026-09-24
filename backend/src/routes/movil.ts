import express, { type Request } from 'express';
import fs from 'node:fs';
import { z } from 'zod';

import db from '../db/database.ts';
import upload from '../middleware/upload.ts';
import { asyncHandler } from '../middleware/errorHandler.ts';
import { validarId, limitePorUsuario } from '../middleware/security.ts';
import { TOTAL_FACTURAS, SALDO_REAL } from '../db/saldos.ts';
import { contenidoValido, rutaPublica, registrarArchivo, esArchivoDe, borrarSoporte, RUTA_RECIBO } from '../utils/archivos.ts';
import { conductorDe } from '../utils/auth.ts';
import { HttpError } from '../utils/errores.ts';
import { leerTexto } from '../utils/ocr.ts';
import { extraerDatos, type DatosExtraidos } from '../utils/ocrParser.ts';
import { TIPOS_GASTO, type Bit, type EstadoFormulario, type Gasto } from '../types/dominio.ts';

// API de la app móvil. Solo cuentas con rol "conductor" (ver index.ts) y solo sus propios datos.
const router = express.Router();
router.param('id', validarId);

interface FormularioPropio {
  id: number;
  estado: EstadoFormulario;
  mes_cerrado: Bit;
}

/** El formulario debe ser del conductor (si no, 404: no se revela que existe). */
function formularioPropio(req: Request, id: number | string): FormularioPropio {
  const f = db.prepare(`
    SELECT f.id, f.estado, m.cerrado AS mes_cerrado
    FROM formularios f JOIN meses m ON m.id = f.mes_id
    WHERE f.id = ? AND f.conductor_id = ?
  `).get(id, conductorDe(req).conductor_id) as FormularioPropio | undefined;
  if (!f) throw new HttpError('Formulario no encontrado', 404);
  return f;
}

function exigirEditable(f: FormularioPropio): void {
  if (f.mes_cerrado) throw new HttpError('El mes de este formulario está cerrado', 409);
  if (f.estado === 'legalizado') throw new HttpError('Este formulario ya fue legalizado y no admite más soportes', 409);
}

// GET /api/movil/perfil
router.get('/perfil', asyncHandler((req, res) => {
  const vehiculos = db.prepare(`
    SELECT v.numero_interno, v.placa, vc.rol
    FROM vehiculo_conductor vc JOIN vehiculos v ON v.id = vc.vehiculo_id
    WHERE vc.conductor_id = ? AND v.activo = 1
  `).all(conductorDe(req).conductor_id);
  res.json({ ok: true, data: { nombre: conductorDe(req).nombre, vehiculos } });
}));

// GET /api/movil/formularios — mis formularios (los más recientes primero)
router.get('/formularios', asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT f.id, f.numero, f.fecha_dia, f.ruta, f.estado, f.anticipo,
           m.nombre AS mes_nombre, m.anio AS mes_anio, m.cerrado AS mes_cerrado,
           v.numero_interno, v.placa,
           COUNT(g.id) AS n_gastos,
           ${TOTAL_FACTURAS} AS total_facturas,
           ${SALDO_REAL} AS saldo_real
    FROM formularios f
    JOIN meses m ON m.id = f.mes_id
    JOIN vehiculos v ON v.id = f.vehiculo_id
    LEFT JOIN gastos g ON g.formulario_id = f.id
    WHERE f.conductor_id = ?
    GROUP BY f.id
    ORDER BY m.anio DESC, m.id DESC, f.fecha_dia DESC, f.id DESC
    LIMIT 60
  `).all(conductorDe(req).conductor_id) as { estado: EstadoFormulario; mes_cerrado: Bit }[];

  res.json({
    ok: true,
    data: rows.map((f) => ({ ...f, editable: !f.mes_cerrado && f.estado !== 'legalizado' })),
  });
}));

// GET /api/movil/formularios/:id/gastos
router.get('/formularios/:id/gastos', asyncHandler((req, res) => {
  formularioPropio(req, req.params.id);
  const rows = db.prepare(`
    SELECT id, fecha, tipo, concepto, valor, observacion, soporte, proveedor, nit, numero_documento, origen,
           (creado_por = ?) AS propio
    FROM gastos WHERE formulario_id = ? ORDER BY fecha DESC, id DESC
  `).all(conductorDe(req).id, req.params.id) as { propio: Bit }[];
  res.json({ ok: true, data: rows.map((g) => ({ ...g, propio: Boolean(g.propio) })) });
}));

interface RespuestaAnalisis {
  archivo: string;
  extraido: DatosExtraidos | null;
  ocr: { ok: boolean; confianza: number | null };
  advertencia: string | null;
}

// POST /api/movil/analizar — recibe la foto del soporte y devuelve los datos que se leen en ella
router.post(
  '/analizar',
  limitePorUsuario(20),
  upload.single('foto'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ ok: false, error: 'No se recibió la foto (campo "foto")' });

    if (!contenidoValido(req.file)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ ok: false, error: 'El archivo no es una imagen o PDF válido' });
    }
    registrarArchivo(req.file.filename, conductorDe(req).id);

    const respuesta: RespuestaAnalisis = {
      archivo: rutaPublica(req.file.filename),
      extraido: null,
      ocr: { ok: false, confianza: null },
      advertencia: null,
    };

    if (!req.file.mimetype.startsWith('image/')) {
      respuesta.advertencia = 'Los PDF no se leen automáticamente: escribe los datos.';
      return res.json({ ok: true, data: respuesta });
    }

    try {
      const { texto, confianza } = await leerTexto(fs.readFileSync(req.file.path));
      const extraido = extraerDatos(texto);
      respuesta.extraido = extraido;
      respuesta.ocr = { ok: true, confianza: Math.round(confianza) };
      if (extraido.valor == null && extraido.fecha == null) {
        respuesta.advertencia = 'No se pudo leer el soporte con claridad. Toma la foto de nuevo con buena luz o escribe los datos.';
      }
    } catch (err) {
      const e = err as Error & { status?: number };
      console.error('[OCR]', e.message);
      respuesta.advertencia = e.status === 503
        ? e.message
        : 'No se pudo leer el soporte automáticamente. Escribe los datos a mano.';
    }

    res.json({ ok: true, data: respuesta });
  }),
);

const Fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').refine((f) => {
  const t = Date.parse(f + 'T00:00:00Z');
  const ahora = Date.now();
  return Number.isFinite(t) && t <= ahora + 2 * 86_400_000 && t >= ahora - 2 * 365 * 86_400_000;
}, 'La fecha del soporte no es válida (no puede ser futura ni de hace más de 2 años)');

const GastoMovilSchema = z.object({
  formulario_id: z.number().int().positive(),
  fecha: Fecha,
  tipo: z.enum(TIPOS_GASTO),
  concepto: z.string().trim().min(1, 'Escribe un concepto').max(120),
  valor: z.number().int('El valor debe ser en pesos enteros').positive('El valor debe ser mayor que cero').max(50_000_000),
  observacion: z.string().trim().max(300).optional().default(''),
  proveedor: z.string().trim().max(120).nullable().optional(),
  nit: z.string().trim().regex(/^[\d.\-\s]{6,20}$/, 'NIT inválido').nullable().optional().or(z.literal('').transform(() => null)),
  numero_documento: z.string().trim().max(40).nullable().optional(),
  soporte: z.string().regex(RUTA_RECIBO, 'Falta la foto del soporte'),
  ocr_confianza: z.number().min(0).max(100).nullable().optional(),
  confirmar_duplicado: z.boolean().optional(),
});

// POST /api/movil/gastos — registra el gasto con su soporte
router.post('/gastos', limitePorUsuario(60), asyncHandler((req, res) => {
  const body = GastoMovilSchema.parse(req.body);

  const f = formularioPropio(req, body.formulario_id);
  exigirEditable(f);

  const usuario = conductorDe(req);
  if (!esArchivoDe(body.soporte, usuario.id)) {
    return res.status(400).json({ ok: false, error: 'La foto del soporte no es válida. Vuelve a tomarla.' });
  }
  if (db.prepare('SELECT 1 FROM gastos WHERE soporte = ?').get(body.soporte)) {
    return res.status(409).json({ ok: false, error: 'Esta foto ya se usó en otro gasto' });
  }

  // Aviso de posible factura duplicada (mismo NIT y número de documento, en cualquier formulario)
  if (body.nit && body.numero_documento && !body.confirmar_duplicado) {
    const dup = db.prepare(`
      SELECT g.id, f.numero AS formulario FROM gastos g JOIN formularios f ON f.id = g.formulario_id
      WHERE g.nit = ? AND g.numero_documento = ?
    `).get(body.nit, body.numero_documento) as { id: number; formulario: string } | undefined;
    if (dup) {
      return res.status(409).json({
        ok: false,
        codigo: 'POSIBLE_DUPLICADO',
        error: `Ya hay un gasto con esta factura (formulario ${dup.formulario}). ¿Es otro soporte distinto?`,
      });
    }
  }

  const r = db.prepare(`
    INSERT INTO gastos (formulario_id, fecha, tipo, concepto, valor, observacion, soporte,
                        proveedor, nit, numero_documento, creado_por, origen, ocr_confianza)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'app_movil', ?)
  `).run(
    body.formulario_id, body.fecha, body.tipo, body.concepto, body.valor, body.observacion, body.soporte,
    body.proveedor || null, body.nit || null, body.numero_documento || null, usuario.id, body.ocr_confianza ?? null,
  );

  res.status(201).json({ ok: true, data: { id: r.lastInsertRowid } });
}));

// DELETE /api/movil/gastos/:id — solo los que subí yo, mientras el formulario siga abierto
router.delete('/gastos/:id', asyncHandler((req, res) => {
  const g = db.prepare('SELECT id, formulario_id, soporte, creado_por FROM gastos WHERE id = ?').get(req.params.id) as
    | Pick<Gasto, 'id' | 'formulario_id' | 'soporte' | 'creado_por'>
    | undefined;
  if (!g || g.creado_por !== conductorDe(req).id) {
    return res.status(404).json({ ok: false, error: 'Gasto no encontrado' });
  }
  exigirEditable(formularioPropio(req, g.formulario_id));

  db.prepare('DELETE FROM gastos WHERE id = ?').run(g.id);
  borrarSoporte(g.soporte);
  res.json({ ok: true });
}));


export default router;
