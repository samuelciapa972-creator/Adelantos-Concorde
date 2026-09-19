import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, Navigate } from 'react-router-dom'
import { Camera, Trash2, FileText, Lock, Receipt } from 'lucide-react'
import { getFormulariosMovil, getGastosMovil, eliminarGastoMovil } from '../api'
import { fmt } from '../utils/format'
import { TIPOS_GASTO, ETIQUETA_TIPO } from '../utils/gastos'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import MovilLayout from './MovilLayout'

const esPdf = (ruta = '') => ruta.toLowerCase().endsWith('.pdf')

function Resumen({ etiqueta, valor, tono, hint, className = '' }) {
  const colores = { ok: 'text-ok', bad: 'text-bad' }
  return (
    <div className={`bg-surface-sunken rounded-xl px-3.5 py-3 ${className}`}>
      <p className="text-[11px] uppercase tracking-wider text-ink-mute">{etiqueta}</p>
      <p className={`font-display text-[22px] font-semibold leading-tight whitespace-nowrap ${colores[tono] ?? ''}`}>{valor}</p>
      {hint && <p className="text-xs text-ink-mute mt-0.5">{hint}</p>}
    </div>
  )
}

export default function FormularioMovil({ onCambiarPassword }) {
  const { id } = useParams()
  const qc = useQueryClient()
  const toast = useToast()
  const [aEliminar, setAEliminar] = useState(null)

  const { data: formularios = [], isLoading } = useQuery({ queryKey: ['movil', 'formularios'], queryFn: getFormulariosMovil })
  const { data: gastos = [], isLoading: cargandoGastos } = useQuery({
    queryKey: ['movil', 'gastos', id],
    queryFn: () => getGastosMovil(id),
  })

  const eliminar = useMutation({
    mutationFn: eliminarGastoMovil,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movil'] })
      setAEliminar(null)
      toast.ok('Soporte eliminado')
    },
  })

  const f = formularios.find((x) => String(x.id) === id)
  if (!isLoading && !f) return <Navigate to="/" replace />

  const saldo = f?.saldo_real ?? 0

  return (
    <MovilLayout titulo={f ? `Formulario ${f.numero}` : 'Formulario'} atras="/" onCambiarPassword={onCambiarPassword}>
      {!f ? <Skeleton className="h-40 rounded-xl" /> : (
        <>
          <section className="panel p-4 mb-5" aria-label="Resumen del formulario">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-sm text-ink-soft min-w-0">Día {f.fecha_dia} · {f.mes_nombre} {f.mes_anio}<br />Bus {f.numero_interno}{f.ruta ? ` · ${f.ruta}` : ''}</p>
              <Badge estado={f.estado} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Resumen etiqueta="Anticipo" valor={fmt(f.anticipo)} />
              <Resumen etiqueta="Facturas" valor={fmt(f.total_facturas)} />
              <Resumen className="col-span-2" etiqueta="Saldo" valor={fmt(Math.abs(saldo))} tono={saldo > 0 ? 'ok' : saldo < 0 ? 'bad' : undefined}
                hint={saldo > 0 ? 'A favor de la empresa (sobró del anticipo)' : saldo < 0 ? 'A tu favor (gastaste más que el anticipo)' : 'Cuentas en cero'} />
            </div>
          </section>

          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute mb-2 font-sans">Soportes ({gastos.length})</h2>

          {cargandoGastos ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : gastos.length === 0 ? (
            <div className="panel"><EmptyState icon={Receipt} title="Sin soportes todavía">Toma una foto de cada factura o recibo de este viaje.</EmptyState></div>
          ) : (
            <ul className="space-y-3 list-none p-0 m-0">
              {gastos.map((g) => {
                const Icono = TIPOS_GASTO.find((t) => t.value === g.tipo)?.icon ?? Receipt
                return (
                  <li key={g.id} className="panel p-3 flex gap-3">
                    <a href={g.soporte ?? undefined} target="_blank" rel="noopener noreferrer"
                      className="shrink-0 w-[72px] h-[72px] rounded-lg overflow-hidden bg-surface-sunken border border-line flex items-center justify-center"
                      aria-label={`Ver la foto del soporte de ${g.concepto}`}>
                      {g.soporte && !esPdf(g.soporte)
                        ? <img src={g.soporte} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <FileText size={26} className="text-ink-mute" aria-hidden="true" />}
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-ink truncate">{g.concepto}</p>
                        <p className="font-display text-lg font-semibold tabular-nums shrink-0">{fmt(g.valor)}</p>
                      </div>
                      <p className="text-xs text-ink-mute mt-0.5 flex items-center gap-1.5">
                        <Icono size={12} aria-hidden="true" />{ETIQUETA_TIPO[g.tipo] ?? g.tipo} · {g.fecha}
                      </p>
                      {(g.nit || g.numero_documento) && (
                        <p className="text-[11px] text-ink-mute mt-0.5 truncate">{[g.nit && `NIT ${g.nit}`, g.numero_documento && `N° ${g.numero_documento}`].filter(Boolean).join(' · ')}</p>
                      )}
                      {g.propio && f.editable && (
                        <button onClick={() => setAEliminar(g)} className="mt-1.5 text-xs text-bad flex items-center gap-1 min-h-[28px]"><Trash2 size={13} aria-hidden="true" />Eliminar</button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {!f.editable && (
            <p className="mt-5 chip-mute !rounded-xl !px-4 !py-3 !text-sm w-full"><Lock size={14} aria-hidden="true" />{f.estado === 'legalizado' ? 'Este formulario ya fue legalizado.' : 'El mes está cerrado.'} No se pueden agregar soportes.</p>
          )}

          {f.editable && (
            <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-surface via-surface to-transparent pt-6 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Link to={`/f/${f.id}/nuevo`} className="btn-primary btn-lg w-full max-w-xl mx-auto flex shadow-pop"><Camera size={20} aria-hidden="true" />Agregar soporte</Link>
            </div>
          )}
        </>
      )}

      {aEliminar && (
        <ConfirmDialog
          title="Eliminar soporte"
          message={`Se eliminará «${aEliminar.concepto}» (${fmt(aEliminar.valor)}) junto con su foto.`}
          confirmLabel="Eliminar"
          busy={eliminar.isPending}
          onConfirm={() => eliminar.mutate(aEliminar.id)}
          onCancel={() => setAEliminar(null)}
        />
      )}
    </MovilLayout>
  )
}
