import express from 'express'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import fs from 'node:fs'
import db from '../db/database.ts'
import { PNG_PATH } from '../utils/convertLogo.ts'
import { SALDOS_COLUMNS } from '../db/saldos.ts'
import { validarId } from '../middleware/security.ts'
import { asyncHandler } from '../middleware/errorHandler.ts'
import type { EstadoFormulario, Mes, Saldos } from '../types/dominio.ts'

interface FilaReporte extends Saldos {
  fecha_dia: number
  numero: string
  ruta: string | null
  anticipo: number
  tasa_uso: number
  hospedaje: number
  mantenimiento: number
  estado: EstadoFormulario
  notas: string | null
  conductor: string
  numero_interno: string
  titular_nombre: string | null
  relevador_nombre: string | null
  total_gastos: number
}

interface Columna {
  label: string
  key: keyof FilaReporte
  width: number
  money: boolean
}

const router = express.Router()
router.param('mesId', validarId)

// Deja solo caracteres seguros para la cabecera Content-Disposition
const nombreSeguro = (s: unknown): string => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_')

const getFormularios = (mesId: string, vehiculoId: string | undefined): FilaReporte[] => {
  const wheres = ['f.mes_id = ?']
  const params: string[] = [mesId]

  if (vehiculoId) {
    wheres.push('f.vehiculo_id = ?')
    params.push(vehiculoId)
  }

  return db.prepare(`
    SELECT
      f.fecha_dia,
      f.numero,
      f.ruta,
      f.anticipo,
      f.tasa_uso,
      f.hospedaje,
      f.mantenimiento,
      f.estado,
      f.notas,
      c.nombre AS conductor,
      v.numero_interno,
      ct.nombre AS titular_nombre,
      cr.nombre AS relevador_nombre,
      COALESCE(SUM(g.valor), 0) AS total_gastos,
      ${SALDOS_COLUMNS}
    FROM formularios f
    JOIN conductores c ON c.id = f.conductor_id
    JOIN vehiculos   v ON v.id = f.vehiculo_id
    LEFT JOIN vehiculo_conductor vct ON vct.vehiculo_id = f.vehiculo_id AND vct.rol = 'titular'
    LEFT JOIN conductores ct ON ct.id = vct.conductor_id
    LEFT JOIN vehiculo_conductor vcr ON vcr.vehiculo_id = f.vehiculo_id AND vcr.rol = 'relevador'
    LEFT JOIN conductores cr ON cr.id = vcr.conductor_id
    LEFT JOIN gastos g ON g.formulario_id = f.id
    WHERE ${wheres.join(' AND ')}
    GROUP BY f.id
    ORDER BY f.fecha_dia, f.id
  `).all(...params) as FilaReporte[]
}

const getMes = (mesId: string) =>
  db.prepare('SELECT * FROM meses WHERE id = ?').get(mesId) as Mes | undefined

const fmt    = (n: number | null | undefined): string => `$${Math.round(n ?? 0).toLocaleString('es-CO')}`
const fmtNum = (n: number | null | undefined): number => Math.round(n ?? 0)

const COLS: Columna[] = [
  { label: 'Fecha',             key: 'fecha_dia',              width: 7,  money: false },
  { label: 'N° Cuenta',         key: 'numero',                 width: 13, money: false },
  { label: 'Ruta',              key: 'ruta',                   width: 24, money: false },
  { label: 'Anticipo',          key: 'anticipo',               width: 13, money: true  },
  { label: 'Tasa uso',          key: 'tasa_uso',               width: 11, money: true  },
  { label: 'Hospedaje',         key: 'hospedaje',              width: 11, money: true  },
  { label: 'Mantenimiento',     key: 'mantenimiento',          width: 13, money: true  },
  { label: 'Saldo empresa',     key: 'saldo_empresa',          width: 14, money: true  },
  { label: 'Saldo empresa 2',   key: 'saldo_empresa_relevador',width: 14, money: true  },
  { label: 'A favor conductor', key: 'saldo_conductor',        width: 16, money: true  },
  { label: 'A favor relevador', key: 'saldo_relevador',        width: 16, money: true  },
  { label: 'Pendientes',        key: 'estado',                 width: 14, money: false },
  { label: 'Observación',       key: 'notas',                  width: 26, money: false },
  { label: 'Conductor',         key: 'titular_nombre',         width: 20, money: false },
  { label: 'Relevador',         key: 'relevador_nombre',       width: 20, money: false },
]

// ── EXCEL ─────────────────────────────────────────────────────────────────────
router.get('/excel/:mesId', asyncHandler(async (req, res) => {
  const mesId       = req.params.mesId ?? ''
  const vehiculo_id = typeof req.query.vehiculo_id === 'string' ? req.query.vehiculo_id : undefined
  const mes  = getMes(mesId)
  if (!mes) return res.status(404).json({ ok: false, error: 'Mes no encontrado' })
  const rows = getFormularios(mesId, vehiculo_id)

  const vehiculoInfo = vehiculo_id
    ? db.prepare('SELECT numero_interno FROM vehiculos WHERE id = ?').get(vehiculo_id) as { numero_interno: string } | undefined
    : null
  const vehiculo = vehiculoInfo?.numero_interno ?? rows[0]?.numero_interno ?? 'Todos'

  const wb    = new ExcelJS.Workbook()
  wb.creator  = 'Viáticos VH'
  const sheet = wb.addWorksheet('Viáticos')

  // ── Fila 1: título principal ──
  sheet.mergeCells(1, 1, 1, COLS.length)
  const t1 = sheet.getCell('A1')
  t1.value     = `REPORTE DE VIÁTICOS — BUS ${vehiculo}`
  t1.font      = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  t1.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }
  t1.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 28

  // ── Fila 2: subtítulo ──
  sheet.mergeCells(2, 1, 2, COLS.length)
  const t2 = sheet.getCell('A2')
  t2.value     = `${mes?.nombre ?? ''} ${mes?.anio ?? ''} — Generado el ${new Date().toLocaleDateString('es-CO')}`
  t2.font      = { size: 10, color: { argb: 'FF71717A' } }
  t2.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } }
  t2.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(2).height = 18

  sheet.addRow([]) // fila vacía

  // ── Fila 4: encabezados ──
  const headerRow = sheet.addRow(COLS.map(c => c.label))
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = {
      bottom: { style: 'medium', color: { argb: 'FF52525B' } },
      right:  { style: 'thin',   color: { argb: 'FF3F3F46' } },
    }
  })

  sheet.columns = COLS.map(c => ({ width: c.width }))

  const moneyFmt    = '"$"#,##0'
  const estadoColor: Record<EstadoFormulario, string> = {
    legalizado:    'FFD1FAE5',
    pendiente:     'FFFEF3C7',
    sin_legalizar: 'FFFEE2E2',
  }

  // ── Filas de datos ──
  rows.forEach((r, i) => {
    const values = COLS.map(c => {
      if (c.key === 'titular_nombre')   return r.titular_nombre   || r.conductor || '—'
      if (c.key === 'relevador_nombre') return r.relevador_nombre || '—'
      if (c.key === 'ruta')             return r.ruta || '—'
      if (c.key === 'notas')            return r.notas || ''
      return r[c.key] ?? '—'
    })

    const row = sheet.addRow(values)
    row.height = 16

    const bg = estadoColor[r.estado] ?? 'FFFFFFFF'
    const altBg = i % 2 === 0 ? bg : (r.estado === 'legalizado' ? 'FFE6FAF0' : bg)

    row.eachCell((cell, colIdx) => {
      const col = COLS[colIdx - 1]
      if (col?.money) cell.numFmt = moneyFmt
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: altBg } }
      cell.alignment = { horizontal: col?.money ? 'right' : 'left', vertical: 'middle' }
      cell.border    = {
        bottom: { style: 'hair',  color: { argb: 'FFD4D4D8' } },
        right:  { style: 'hair',  color: { argb: 'FFD4D4D8' } },
      }
      cell.font = { size: 9 }
    })
  })

  // ── Fila vacía ──
  sheet.addRow([])

  // ── Fila totales ──
  const totValues = COLS.map(c => {
    if (!c.money) return c.key === 'numero' ? 'TOTALES' : ''
    return rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0)
  })
  const totRow = sheet.addRow(totValues)
  totRow.height = 18
  totRow.eachCell((cell, colIdx) => {
    const col = COLS[colIdx - 1]
    cell.font      = { bold: true, size: 9 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } }
    cell.alignment = { horizontal: col?.money ? 'right' : 'left', vertical: 'middle' }
    cell.border    = {
      top:    { style: 'medium', color: { argb: 'FF18181B' } },
      bottom: { style: 'medium', color: { argb: 'FF18181B' } },
    }
    if (col?.money) cell.numFmt = moneyFmt
  })

  // ── Cuadro resumen ──
  const totalEmpresaTitular   = rows.reduce((s, r) => s + r.saldo_empresa,            0)
  const totalEmpresaRelevador = rows.reduce((s, r) => s + r.saldo_empresa_relevador,  0)
  const totalCondTitular      = rows.reduce((s, r) => s + r.saldo_conductor,          0)
  const totalCondRelevador    = rows.reduce((s, r) => s + r.saldo_relevador,          0)
  const deudaTitular          = Math.max(0, totalEmpresaTitular   - totalCondTitular)
  const deudaRelevador        = Math.max(0, totalEmpresaRelevador - totalCondRelevador)
  const nombreTitular         = rows.find(r => r.titular_nombre)?.titular_nombre   ?? 'Conductor'
  const nombreRelevador       = rows.find(r => r.relevador_nombre)?.relevador_nombre ?? 'Relevador'

  sheet.addRow([])
  sheet.addRow([])

  // Título resumen
  const rStart = sheet.rowCount + 1
  sheet.mergeCells(rStart, 1, rStart, 4)
  const resTitle = sheet.getCell(rStart, 1)
  resTitle.value     = `RESUMEN ${mes?.nombre?.toUpperCase() ?? ''} ${mes?.anio ?? ''} — BUS ${vehiculo}`
  resTitle.font      = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
  resTitle.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF18181B' } }
  resTitle.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(rStart).height = 20

  const resHeaders = ['Concepto', nombreTitular, '', nombreRelevador]
  const rhRow = sheet.addRow(resHeaders)
  rhRow.height = 16
  rhRow.eachCell((cell) => {
    cell.font      = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F3F46' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })

  const resFilas: [string, number, string, number][] = [
    ['Saldo a favor empresa', fmtNum(totalEmpresaTitular),   '', fmtNum(totalEmpresaRelevador)],
    ['A favor conductor',     fmtNum(totalCondTitular),      '', fmtNum(totalCondRelevador)],
    ['DEBE a la empresa',     fmtNum(deudaTitular),          '', fmtNum(deudaRelevador)],
  ]

  resFilas.forEach(([label, vT, , vR], i) => {
    const rf    = sheet.addRow([label, vT, '', vR])
    const esDebe = i === 2
    rf.height   = 16
    rf.eachCell((cell, ci) => {
      cell.font      = { bold: esDebe, size: 9, color: { argb: esDebe ? 'FFDC2626' : 'FF18181B' } }
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF4F4F5' : 'FFFFFFFF' } }
      cell.alignment = { horizontal: ci === 1 ? 'left' : 'right', vertical: 'middle' }
      if (ci !== 1 && ci !== 3) return
      cell.numFmt = moneyFmt
    })
  })

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=${nombreSeguro(`viaticos_bus${vehiculo}_${mes?.nombre ?? mesId}_${mes?.anio ?? ''}`)}.xlsx`)
  await wb.xlsx.write(res)
  res.end()
}))

// ── PDF ───────────────────────────────────────────────────────────────────────
router.get('/pdf/:mesId', (req, res) => {
  const mesId       = req.params.mesId ?? ''
  const vehiculo_id = typeof req.query.vehiculo_id === 'string' ? req.query.vehiculo_id : undefined
  const mes  = getMes(mesId)
  if (!mes) return res.status(404).json({ ok: false, error: 'Mes no encontrado' })
  const rows = getFormularios(mesId, vehiculo_id)

  const vehiculoInfo = vehiculo_id
    ? db.prepare('SELECT numero_interno FROM vehiculos WHERE id = ?').get(vehiculo_id) as { numero_interno: string } | undefined
    : null
  const vehiculo = vehiculoInfo?.numero_interno ?? rows[0]?.numero_interno ?? 'Todos los vehículos'

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' })
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${nombreSeguro(`viaticos_bus${vehiculo}_${mes?.nombre ?? mesId}_${mes?.anio ?? ''}`)}.pdf`)
  doc.pipe(res)

  const pageW  = doc.page.width  - 60
  const startX = 30

  // ── HEADER ───────────────────────────────────────────
  // Fondo negro
  doc.rect(startX, 18, pageW, 56).fill('#18181b')

  // Línea decorativa inferior del header
  doc.rect(startX, 74, pageW, 3).fill('#3f3f46')

  // Logo
  if (fs.existsSync(PNG_PATH)) {
    doc.image(PNG_PATH, startX + 10, 26, { height: 38 })
  }

  // Línea vertical separadora
  doc.rect(startX + 170, 26, 1, 36).fill('#3f3f46')

  // Título y subtítulo
  doc.fillColor('#ffffff')
     .fontSize(14).font('Helvetica-Bold')
     .text(
       `BUS ${vehiculo}`,
       startX + 182, 26,
       { width: pageW - 190, align: 'left', lineBreak: false }
     )

  doc.fillColor('#a1a1aa')
     .fontSize(9).font('Helvetica')
     .text(
       `Reporte de Viáticos — ${mes?.nombre ?? ''} ${mes?.anio ?? ''}`,
       startX + 182, 44,
       { width: pageW - 190, align: 'left', lineBreak: false }
     )

  doc.fillColor('#52525b')
     .fontSize(7.5).font('Helvetica')
     .text(
       `Generado el ${new Date().toLocaleDateString('es-CO')}`,
       startX + 182, 58,
       { width: pageW - 190, align: 'left', lineBreak: false }
     )

  // ── TABLA ────────────────────────────────────────────
  const pdfCols = [
    { label: 'Fecha',         width: 26  },
    { label: 'N° Cuenta',     width: 52  },
    { label: 'Ruta',          width: 98  },
    { label: 'Anticipo',      width: 52  },
    { label: 'Tasa uso',      width: 46  },
    { label: 'Hospedaje',     width: 46  },
    { label: 'Mantenim.',     width: 46  },
    { label: 'Saldo emp.',    width: 52  },
    { label: 'Saldo emp.2',   width: 52  },
    { label: 'A fav. cond.',  width: 56  },
    { label: 'A fav. relev.', width: 56  },
    { label: 'Pendientes',    width: 50  },
    { label: 'Conductor',     width: 68  },
    { label: 'Relevador',     width: 68  },
  ]

  const totalW = pdfCols.reduce((s, c) => s + c.width, 0)
  let y = 84

  // Cabecera tabla
  doc.rect(startX, y, totalW, 18).fill('#27272a')
  doc.fillColor('#ffffff').fontSize(6).font('Helvetica-Bold')
  let x = startX
  pdfCols.forEach(col => {
    doc.text(col.label, x + 2, y + 5, { width: col.width - 4, lineBreak: false, align: 'center' })
    x += col.width
  })
  y += 18

  const estadoColor: Record<EstadoFormulario, string> = {
    legalizado:    '#ecfdf5',
    pendiente:     '#fefce8',
    sin_legalizar: '#fef2f2',
  }

  // Filas
  rows.forEach((r, i) => {
    const rowH = 14
    const bg   = i % 2 === 0
      ? (estadoColor[r.estado] ?? '#ffffff')
      : (r.estado === 'legalizado' ? '#d1fae5' : estadoColor[r.estado] ?? '#f4f4f5')

    doc.rect(startX, y, totalW, rowH).fill(bg)

    // Línea separadora entre filas
    doc.rect(startX, y + rowH - 0.5, totalW, 0.5).fill('#e4e4e7')

    doc.fillColor('#18181b').fontSize(6).font('Helvetica')

    x = startX
    const valores = [
      r.fecha_dia,
      r.numero,
      r.ruta || '—',
      fmt(r.anticipo),
      fmt(r.tasa_uso),
      r.hospedaje     > 0 ? fmt(r.hospedaje)                : '—',
      r.mantenimiento > 0 ? fmt(r.mantenimiento)             : '—',
      r.saldo_empresa           > 0 ? fmt(r.saldo_empresa)           : '—',
      r.saldo_empresa_relevador > 0 ? fmt(r.saldo_empresa_relevador) : '—',
      r.saldo_conductor > 0 ? fmt(r.saldo_conductor)         : '—',
      r.saldo_relevador > 0 ? fmt(r.saldo_relevador)         : '—',
      r.estado === 'legalizado' ? 'LEGALIZADO' : r.estado === 'pendiente' ? 'PENDIENTE' : 'SIN LEGALIZAR',
      r.titular_nombre   || r.conductor || '—',
      r.relevador_nombre || '—',
    ]

    valores.forEach((val, idx) => {
      const ancho = pdfCols[idx]?.width ?? 0
      doc.text(String(val), x + 2, y + 4, { width: ancho - 4, lineBreak: false, align: 'center' })
      x += ancho
    })

    y += rowH

    if (y > 515) {
      doc.addPage()
      y = 30
    }
  })

  // Fila totales
  y += 3
  doc.rect(startX, y, totalW, 16).fill('#18181b')
  doc.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
  x = startX
  const totales = [
    '', 'TOTALES', '',
    fmt(rows.reduce((s, r) => s + r.anticipo,               0)),
    fmt(rows.reduce((s, r) => s + r.tasa_uso,                0)),
    fmt(rows.reduce((s, r) => s + r.hospedaje,               0)),
    fmt(rows.reduce((s, r) => s + r.mantenimiento,           0)),
    fmt(rows.reduce((s, r) => s + r.saldo_empresa,           0)),
    fmt(rows.reduce((s, r) => s + r.saldo_empresa_relevador, 0)),
    fmt(rows.reduce((s, r) => s + r.saldo_conductor,         0)),
    fmt(rows.reduce((s, r) => s + r.saldo_relevador,         0)),
    '', '', '',
  ]
  totales.forEach((val, idx) => {
    const ancho = pdfCols[idx]?.width ?? 0
    doc.text(val, x + 2, y + 5, { width: ancho - 4, lineBreak: false, align: 'center' })
    x += ancho
  })
  y += 20

  // ── CUADRO RESUMEN FINAL ─────────────────────────────
  const totalEmpresaTitular   = rows.reduce((s, r) => s + r.saldo_empresa,           0)
  const totalEmpresaRelevador = rows.reduce((s, r) => s + r.saldo_empresa_relevador, 0)
  const totalCondTitular      = rows.reduce((s, r) => s + r.saldo_conductor,         0)
  const totalCondRelevador    = rows.reduce((s, r) => s + r.saldo_relevador,         0)
  const deudaTitular          = Math.max(0, totalEmpresaTitular   - totalCondTitular)
  const deudaRelevador        = Math.max(0, totalEmpresaRelevador - totalCondRelevador)
  const nombreTitular         = rows.find(r => r.titular_nombre)?.titular_nombre    ?? 'Conductor'
  const nombreRelevador       = rows.find(r => r.relevador_nombre)?.relevador_nombre ?? 'Relevador'

  if (y > 470) { doc.addPage(); y = 30 }

  y += 12
  const boxW  = 240
  const gap   = 16
  const box1X = startX
  const box2X = startX + boxW + gap

  // Título resumen
  doc.rect(box1X, y, boxW * 2 + gap, 18).fill('#18181b')
  doc.rect(box1X, y + 18, boxW * 2 + gap, 2).fill('#3f3f46')
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
     .text(
       `RESUMEN ${mes?.nombre?.toUpperCase() ?? ''} ${mes?.anio ?? ''} — BUS ${vehiculo}`,
       box1X, y + 5,
       { width: boxW * 2 + gap, align: 'center', lineBreak: false }
     )
  y += 20

  // Encabezados columnas
  doc.rect(box1X, y, boxW, 16).fill('#27272a')
  doc.rect(box2X, y, boxW, 16).fill('#27272a')
  doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold')
     .text(nombreTitular,   box1X + 6, y + 4, { width: boxW - 12, lineBreak: false })
     .text(nombreRelevador, box2X + 6, y + 4, { width: boxW - 12, lineBreak: false })
  y += 16

  const filasCuadro = [
    { label: 'Saldo a favor empresa', vT: totalEmpresaTitular,   vR: totalEmpresaRelevador, debe: false },
    { label: 'A favor conductor',     vT: totalCondTitular,      vR: totalCondRelevador,    debe: false },
    { label: 'DEBE a la empresa',     vT: deudaTitular,          vR: deudaRelevador,        debe: true  },
  ]

  filasCuadro.forEach((fila, i) => {
    const bg = i % 2 === 0 ? '#f4f4f5' : '#ffffff'

    doc.rect(box1X, y, boxW, 16).fill(bg)
    doc.rect(box2X, y, boxW, 16).fill(bg)

    // Línea separadora vertical entre las dos cajas
    doc.rect(box1X + boxW + 1, y, gap - 2, 16).fill('#f4f4f5')

    const color = fila.debe ? '#dc2626' : '#18181b'
    const font  = fila.debe ? 'Helvetica-Bold' : 'Helvetica'

    doc.fillColor(color).fontSize(8).font(font)

    // Caja titular
    doc.text(fila.label,      box1X + 6,       y + 4, { width: boxW / 2 - 6,  lineBreak: false })
    doc.text(fmt(fila.vT),    box1X + boxW / 2, y + 4, { width: boxW / 2 - 6,  lineBreak: false, align: 'right' })

    // Caja relevador
    doc.text(fila.label,      box2X + 6,       y + 4, { width: boxW / 2 - 6,  lineBreak: false })
    doc.text(fmt(fila.vR),    box2X + boxW / 2, y + 4, { width: boxW / 2 - 6,  lineBreak: false, align: 'right' })

    y += 16
  })

  // Borde inferior del cuadro
  doc.rect(box1X, y, boxW * 2 + gap, 2).fill('#18181b')

  doc.end()
})


export default router
