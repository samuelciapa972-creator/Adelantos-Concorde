import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Plus, Receipt, ImagePlus, ExternalLink, X, Lock, Smartphone } from 'lucide-react'

import { getGastos, crearGasto, eliminarGasto, subirRecibo } from '../../api'
import { fmt } from '../../utils/format'
import { useToast } from './Toast'
import ConfirmDialog from './ConfirmDialog'
import Field from './Field'
import { TIPOS_GASTO, ETIQUETA_TIPO } from '../../utils/gastos'
import type { Formulario, Gasto, TipoGasto } from '../../types'


const MAX_MB = 10
const TIPOS_ARCHIVO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

interface CamposGasto {
  fecha: string
  tipo: TipoGasto
  concepto: string
  valor: string
  observacion: string
  proveedor: string
  nit: string
  numero_documento: string
}

const VACIO: CamposGasto = { fecha: '', tipo: 'combustible', concepto: '', valor: '', observacion: '', proveedor: '', nit: '', numero_documento: '' }

type TonoResumen = 'neutral' | 'ok' | 'bad'

interface ResumenProps {
  etiqueta: string
  valor: ReactNode
  hint?: string
  tono?: TonoResumen
}

function Resumen({ etiqueta, valor, hint, tono = 'neutral' }: ResumenProps) {
  const colores: Record<TonoResumen, string> = { neutral: 'bg-surface-sunken text-ink', ok: 'bg-ok-soft text-ok', bad: 'bg-bad-soft text-bad' }
  return (
    <div className={`rounded-xl px-4 py-3 ${colores[tono]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">{etiqueta}</p>
      <p className="font-display font-semibold text-[22px] leading-tight mt-0.5">{valor}</p>
      {hint && <p className="text-[11px] opacity-70 mt-0.5">{hint}</p>}
    </div>
  )
}

interface Props {
  formulario: Formulario
  readOnly?: boolean
}

export default function GastosForm({ formulario, readOnly = false }: Props) {
  const qc = useQueryClient()
  const toast = useToast()
  const [form, setForm] = useState<CamposGasto>(VACIO)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [aEliminar, setAEliminar] = useState<Gasto | null>(null)

  const { data: gastos = [], isLoading } = useQuery({
    queryKey: ['gastos', formulario.id],
    queryFn: () => getGastos(formulario.id),
  })

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['gastos', formulario.id] })
    qc.invalidateQueries({ queryKey: ['formularios'] })
    qc.invalidateQueries({ queryKey: ['resumen'] })
  }

  const agregar = useMutation({
    meta: { inline: true },
    mutationFn: async () => {
      // 1) sube el soporte (si hay) y 2) crea el gasto con su ruta
      const soporte = archivo ? await subirRecibo(archivo) : null
      return crearGasto({
        formulario_id: formulario.id,
        fecha: form.fecha,
        tipo: form.tipo,
        concepto: form.concepto.trim(),
        valor: Number(form.valor),
        observacion: form.observacion.trim(),
        proveedor: form.proveedor.trim() || null,
        nit: form.nit.trim() || null,
        numero_documento: form.numero_documento.trim() || null,
        soporte,
      })
    },
    onSuccess: () => {
      refrescar()
      setForm(VACIO)
      setArchivo(null)
      setPreview(null)
      toast.ok('Gasto agregado')
    },
  })

  const eliminar = useMutation({
    mutationFn: eliminarGasto,
    onSuccess: () => { refrescar(); setAEliminar(null); toast.ok('Gasto eliminado') },
  })

  type Control = HTMLInputElement | HTMLSelectElement
  const set = (campo: keyof CamposGasto) => (e: ChangeEvent<Control>) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  function elegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setErrorArchivo('')
    if (!file) return
    if (!TIPOS_ARCHIVO.includes(file.type)) return setErrorArchivo('Solo se admiten imágenes JPG, PNG, WebP o PDF.')
    if (file.size > MAX_MB * 1024 * 1024) return setErrorArchivo(`El archivo supera ${MAX_MB} MB.`)
    setArchivo(file)
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  // Misma regla que el servidor: tasa de uso + hospedaje + mantenimiento + gastos
  const totalGastos = gastos.reduce((s, g) => s + g.valor, 0)
  const base = (formulario.tasa_uso ?? 0) + (formulario.hospedaje ?? 0) + (formulario.mantenimiento ?? 0)
  const totalFacturas = base + totalGastos
  const saldo = formulario.anticipo - totalFacturas

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Resumen etiqueta="Anticipo" valor={fmt(formulario.anticipo)} />
        <Resumen etiqueta="Total facturas" valor={fmt(totalFacturas)} hint={`Fijos ${fmt(base)} + gastos ${fmt(totalGastos)}`} />
        <Resumen
          etiqueta="Saldo"
          valor={fmt(Math.abs(saldo))}
          tono={saldo > 0 ? 'ok' : saldo < 0 ? 'bad' : 'neutral'}
          hint={saldo > 0 ? 'A favor de la empresa' : saldo < 0 ? 'A favor del conductor' : 'Cuentas en cero'}
        />
        <Resumen etiqueta="Gastos" valor={gastos.length} hint="registrados" />
      </div>

      {/* Listado */}
      <section className="border border-line rounded-xl overflow-hidden" aria-label="Gastos registrados">
        <div className="px-4 py-3 bg-surface-sunken/60 border-b border-line flex items-center gap-2">
          <Receipt size={15} className="text-ink-mute" aria-hidden="true" />
          <h3 className="text-sm font-semibold font-sans">Gastos registrados</h3>
        </div>

        {isLoading ? (
          <p className="p-6 text-center text-sm text-ink-mute">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-mute">Este formulario aún no tiene gastos registrados.</p>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Proveedor / NIT / N°</th><th className="!text-right">Valor</th><th>Observación</th><th>Soporte</th>
                  {!readOnly && <th><span className="sr-only">Acciones</span></th>}
                </tr>
              </thead>
              <tbody>
                {gastos.map((g) => (
                  <tr key={g.id}>
                    <td className="tabular-nums text-ink-soft">{g.fecha}</td>
                    <td><span className="chip-mute">{ETIQUETA_TIPO[g.tipo] ?? g.tipo}</span></td>
                    <td className="!whitespace-normal min-w-[10rem]">
                      {g.concepto}
                      {g.origen === 'app_movil' && <span className="chip-mute !text-[10px] !py-0 ml-2" title={`Subido desde la app por ${g.creado_por_nombre ?? 'un conductor'}`}><Smartphone size={10} aria-hidden="true" />App</span>}
                    </td>
                    <td className="text-xs text-ink-soft !whitespace-normal min-w-[9rem]">
                      {g.proveedor || g.nit || g.numero_documento
                        ? <>{g.proveedor && <span className="block text-ink">{g.proveedor}</span>}{g.nit && <span className="block">NIT {g.nit}</span>}{g.numero_documento && <span className="block">N° {g.numero_documento}</span>}</>
                        : '—'}
                    </td>
                    <td className="num font-medium">{fmt(g.valor)}</td>
                    <td className="text-ink-mute text-xs !whitespace-normal max-w-[12rem]">{g.observacion || '—'}</td>
                    <td>
                      {g.soporte ? (
                        <a href={g.soporte} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                          <ExternalLink size={12} aria-hidden="true" /> Ver soporte
                        </a>
                      ) : <span className="text-ink-mute text-xs">Sin soporte</span>}
                    </td>
                    {!readOnly && (
                      <td className="text-right">
                        <button onClick={() => setAEliminar(g)} className="btn-icon hover:!text-bad hover:!bg-bad-soft" aria-label={`Eliminar gasto ${g.concepto}`}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={4}>Total gastos</td><td className="num">{fmt(totalGastos)}</td><td colSpan={readOnly ? 2 : 3} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Nuevo gasto */}
      {readOnly ? (
        <p className="chip-mute !rounded-lg !px-4 !py-2.5 !text-sm w-full"><Lock size={14} aria-hidden="true" /> Mes cerrado: no se pueden agregar ni eliminar gastos.</p>
      ) : (
        <section className="border border-line rounded-xl p-4" aria-label="Agregar gasto">
          <h3 className="text-sm font-semibold font-sans flex items-center gap-2 mb-4"><Plus size={15} className="text-ink-mute" aria-hidden="true" /> Agregar gasto</h3>

          <form onSubmit={(e) => { e.preventDefault(); agregar.mutate() }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha" required>
              {(id) => <input id={id} type="date" className="input" value={form.fecha} onChange={set('fecha')} required />}
            </Field>
            <Field label="Tipo" required>
              {(id) => <select id={id} className="select" value={form.tipo} onChange={set('tipo')}>{TIPOS_GASTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>}
            </Field>
            <Field label="Concepto" required>
              {(id) => <input id={id} className="input" value={form.concepto} onChange={set('concepto')} placeholder="Ej.: Tanqueo Tunja" required />}
            </Field>
            <Field label="Valor (COP)" required>
              {(id) => <input id={id} type="number" min={1} step={1} inputMode="numeric" className="input tabular-nums" value={form.valor} onChange={set('valor')} placeholder="0" required />}
            </Field>
            <Field label="Proveedor / comercio">
              {(id) => <input id={id} className="input" value={form.proveedor} onChange={set('proveedor')} maxLength={120} placeholder="Opcional" />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIT">
                {(id) => <input id={id} className="input" value={form.nit} onChange={set('nit')} maxLength={20} placeholder="900123456-7" />}
              </Field>
              <Field label="N° de factura">
                {(id) => <input id={id} className="input" value={form.numero_documento} onChange={set('numero_documento')} maxLength={40} />}
              </Field>
            </div>
            <Field label="Observación" className="sm:col-span-2">
              {(id) => <input id={id} className="input" value={form.observacion} onChange={set('observacion')} placeholder="Opcional" />}
            </Field>

            <div className="sm:col-span-2">
              <span className="label">Soporte (foto o PDF, máx. {MAX_MB} MB)</span>
              {archivo ? (
                <div className="flex items-center gap-3 border border-line-strong rounded-lg px-3 py-2">
                  {preview && <img src={preview} alt="Vista previa del soporte" className="h-12 w-12 object-cover rounded-md border border-line" />}
                  <span className="text-sm truncate flex-1">{archivo.name}</span>
                  <button type="button" className="btn-icon" onClick={() => { setArchivo(null); setPreview(null) }} aria-label="Quitar archivo"><X size={16} /></button>
                </div>
              ) : (
                <label className="flex items-center gap-3 border-2 border-dashed border-line-strong rounded-lg px-4 py-3 cursor-pointer hover:border-brand-500 hover:bg-brand-50/40 transition-colors focus-within:ring-2 focus-within:ring-brand-500/40">
                  <ImagePlus size={18} className="text-ink-mute" aria-hidden="true" />
                  <span className="text-sm text-ink-soft">Seleccionar archivo…</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={elegirArchivo} />
                </label>
              )}
              {errorArchivo && <p role="alert" className="field-error">{errorArchivo}</p>}
            </div>

            {agregar.isError && <p role="alert" className="sm:col-span-2 text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{agregar.error.message}</p>}

            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" className="btn-primary" disabled={agregar.isPending}>{agregar.isPending ? 'Guardando…' : 'Agregar gasto'}</button>
            </div>
          </form>
        </section>
      )}

      {aEliminar && (
        <ConfirmDialog
          title="Eliminar gasto"
          message={`Se eliminará «${aEliminar.concepto}» (${fmt(aEliminar.valor)})${aEliminar.soporte ? ' y su soporte' : ''}.`}
          confirmLabel="Eliminar"
          busy={eliminar.isPending}
          onConfirm={() => eliminar.mutate(aEliminar.id)}
          onCancel={() => setAEliminar(null)}
        />
      )}
    </div>
  )
}
