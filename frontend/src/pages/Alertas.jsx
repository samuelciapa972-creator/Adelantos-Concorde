import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CheckCircle2, Clock3, TriangleAlert, CalendarDays, Lock } from 'lucide-react'

import { useMes } from '../context/MesContext'
import { getFormularios, legalizarFormulario } from '../api'
import { fmt } from '../utils/format'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { PageSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'

function FilaAlerta({ f, onLegalizar, deshabilitado, ocupado }) {
  const aFavorEmpresa = f.saldo_real > 0
  const aFavorConductor = f.saldo_real < 0
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 py-4 border-b border-line/70 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          Formulario {f.numero} <span className="font-normal text-ink-mute">· {f.conductor_nombre}</span>
        </p>
        <p className="text-xs text-ink-mute mt-1">
          Día {f.fecha_dia} · Bus {f.numero_interno} <span className="font-mono">({f.placa})</span>
          {f.ruta ? ` · ${f.ruta}` : ''}
        </p>
        {f.notas && <p className="text-xs text-ink-soft mt-1.5 italic">“{f.notas}”</p>}
      </div>

      <div className="sm:text-right">
        <p className={`text-sm font-semibold tabular-nums ${aFavorEmpresa ? 'text-ok' : aFavorConductor ? 'text-bad' : 'text-ink-mute'}`}>
          {fmt(Math.abs(f.saldo_real))}
        </p>
        <p className="text-[11px] text-ink-mute">
          {aFavorEmpresa ? 'a favor de la empresa' : aFavorConductor ? 'a favor del conductor' : 'sin saldo'}
        </p>
      </div>

      <button onClick={() => onLegalizar(f.id)} disabled={deshabilitado || ocupado} className="btn-primary btn-sm self-start sm:self-center">
        <CheckCircle2 size={14} aria-hidden="true" /> Legalizar
      </button>
    </li>
  )
}

function Grupo({ titulo, icono: Icono, tono, formularios, ...props }) {
  if (formularios.length === 0) return null
  return (
    <section className="panel overflow-hidden mb-5" aria-label={titulo}>
      <div className="panel-head bg-surface-sunken/50">
        <div className="flex items-center gap-2.5">
          <Icono size={18} className={tono === 'bad' ? 'text-bad' : 'text-warn'} aria-hidden="true" />
          <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
        </div>
        <span className={tono === 'bad' ? 'chip-bad' : 'chip-warn'}>{formularios.length}</span>
      </div>
      <ul className="px-5 list-none m-0">
        {formularios.map((f) => <FilaAlerta key={f.id} f={f} {...props} />)}
      </ul>
    </section>
  )
}

export default function Alertas() {
  const { mesId, vehiculoId, mes, cerrado } = useMes()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['formularios', mesId, vehiculoId, '', '', ''],
    queryFn: () => getFormularios({ mes_id: mesId, vehiculo_id: vehiculoId || undefined }),
    enabled: Boolean(mesId),
  })

  const legalizar = useMutation({
    mutationFn: legalizarFormulario,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['formularios'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      toast.ok('Formulario legalizado')
    },
  })

  const sinLeg = todos.filter((f) => f.estado === 'sin_legalizar')
  const conPend = todos.filter((f) => f.estado === 'pendiente')

  const cabecera = (
    <PageHeader
      title="Alertas"
      icon={TriangleAlert}
      subtitle={mes ? (
        <span className="inline-flex items-center gap-2">
          Formularios por legalizar · {mes.nombre} {mes.anio}
          {cerrado && <span className="chip-mute"><Lock size={11} aria-hidden="true" />Cerrado</span>}
        </span>
      ) : 'Formularios por legalizar'}
    />
  )

  if (!mesId) {
    return (
      <>
        {cabecera}
        <div className="panel"><EmptyState icon={CalendarDays} title="Ningún mes seleccionado">Elige un mes en el menú lateral para ver sus alertas.</EmptyState></div>
      </>
    )
  }
  if (isLoading) return <PageSkeleton />

  const props = { onLegalizar: legalizar.mutate, deshabilitado: cerrado, ocupado: legalizar.isPending }

  return (
    <>
      {cabecera}
      {cerrado && (
        <p className="mb-5 chip-mute !rounded-lg !px-4 !py-2.5 !text-sm w-full">
          <Lock size={14} aria-hidden="true" /> Este mes está cerrado: reábrelo desde el menú lateral para legalizar formularios.
        </p>
      )}

      {sinLeg.length === 0 && conPend.length === 0 && (
        <div className="panel">
          <EmptyState icon={CheckCircle2} title="Todo está al día">No hay formularios pendientes ni sin legalizar en este mes.</EmptyState>
        </div>
      )}

      <Grupo titulo="Sin legalizar" icono={CircleAlert} tono="bad" formularios={sinLeg} {...props} />
      <Grupo titulo="Pendientes" icono={Clock3} tono="warn" formularios={conPend} {...props} />
    </>
  )
}
