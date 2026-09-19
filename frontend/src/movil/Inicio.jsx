import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BusFront, ChevronRight, Camera, ClipboardList, Lock, CheckCircle2 } from 'lucide-react'
import { getFormulariosMovil, getPerfilMovil } from '../api'
import { fmt } from '../utils/format'
import Badge from '../components/ui/Badge'
import EmptyState from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import MovilLayout from './MovilLayout'

function TarjetaFormulario({ f }) {
  const aFavorEmpresa = f.saldo_real > 0
  return (
    <li>
      <Link to={`/f/${f.id}`} className="panel block p-4 active:bg-surface-sunken transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-ink-mute">Formulario</p>
            <p className="font-display text-2xl font-semibold leading-tight">{f.numero}</p>
            <p className="text-sm text-ink-soft mt-0.5 truncate">Día {f.fecha_dia} · Bus {f.numero_interno}{f.ruta ? ` · ${f.ruta}` : ''}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge estado={f.estado} />
            <ChevronRight size={18} className="text-ink-mute" aria-hidden="true" />
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-line text-sm">
          <div><dt className="text-[11px] text-ink-mute">Anticipo</dt><dd className="font-semibold tabular-nums">{fmt(f.anticipo)}</dd></div>
          <div><dt className="text-[11px] text-ink-mute">Facturas</dt><dd className="font-semibold tabular-nums">{fmt(f.total_facturas)}</dd></div>
          <div>
            <dt className="text-[11px] text-ink-mute">{aFavorEmpresa ? 'A favor empresa' : f.saldo_real < 0 ? 'A tu favor' : 'Saldo'}</dt>
            <dd className={`font-semibold tabular-nums ${aFavorEmpresa ? 'text-ok' : f.saldo_real < 0 ? 'text-bad' : ''}`}>{fmt(Math.abs(f.saldo_real))}</dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-ink-mute flex items-center gap-1.5">
          {f.editable
            ? <><Camera size={13} aria-hidden="true" /><span>{f.n_gastos} soporte{f.n_gastos === 1 ? '' : 's'} · toca para agregar más</span></>
            : <><Lock size={13} aria-hidden="true" /><span>{f.estado === 'legalizado' ? 'Legalizado' : 'Mes cerrado'} · solo lectura</span></>}
        </p>
      </Link>
    </li>
  )
}

export default function Inicio({ onCambiarPassword }) {
  const { data: perfil } = useQuery({ queryKey: ['movil', 'perfil'], queryFn: getPerfilMovil })
  const { data: formularios = [], isLoading, isError, error, refetch } = useQuery({ queryKey: ['movil', 'formularios'], queryFn: getFormulariosMovil })

  // Agrupados por mes
  const grupos = []
  formularios.forEach((f) => {
    const clave = `${f.mes_nombre} ${f.mes_anio}`
    const g = grupos.find((x) => x.clave === clave)
    g ? g.items.push(f) : grupos.push({ clave, cerrado: Boolean(f.mes_cerrado), items: [f] })
  })
  const pendientes = formularios.filter((f) => f.editable).length

  return (
    <MovilLayout titulo="Mis formularios" onCambiarPassword={onCambiarPassword}>
      <section aria-label="Resumen" className="mb-5">
        <p className="text-sm text-ink-mute">Hola,</p>
        <p className="font-display text-[28px] font-semibold leading-tight">{perfil?.nombre?.split(' ')[0] ?? ''}</p>
        {perfil?.vehiculos?.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3 list-none p-0">
            {perfil.vehiculos.map((v) => (
              <li key={v.numero_interno} className="chip-mute"><BusFront size={13} aria-hidden="true" /><span>Bus {v.numero_interno} · <span className="font-mono">{v.placa}</span> · {v.rol}</span></li>
            ))}
          </ul>
        )}
      </section>

      {isLoading && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>}

      {isError && (
        <div className="panel p-5 text-center" role="alert">
          <p className="text-bad font-medium">{error.message}</p>
          <button className="btn-secondary mt-3" onClick={() => refetch()}>Reintentar</button>
        </div>
      )}

      {!isLoading && !isError && formularios.length === 0 && (
        <div className="panel">
          <EmptyState icon={ClipboardList} title="Aún no tienes formularios">
            Cuando el administrador registre tu anticipo, aparecerá aquí para que subas los soportes.
          </EmptyState>
        </div>
      )}

      {pendientes > 0 && (
        <p className="mb-4 flex items-center gap-2 text-sm text-ink-soft bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
          <Camera size={16} className="text-brand-600 shrink-0" aria-hidden="true" />
          <span>Abre un formulario y toca <strong>Agregar soporte</strong> para fotografiar tus facturas.</span>
        </p>
      )}

      {grupos.map((g) => (
        <section key={g.clave} className="mb-6" aria-label={g.clave}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-mute mb-2 flex items-center gap-2 font-sans">
            {g.clave} {g.cerrado && <span className="chip-mute normal-case tracking-normal"><Lock size={11} aria-hidden="true" />Cerrado</span>}
          </h2>
          <ul className="space-y-3 list-none p-0 m-0">{g.items.map((f) => <TarjetaFormulario key={f.id} f={f} />)}</ul>
        </section>
      ))}

      {grupos.length > 0 && <p className="text-center text-xs text-ink-mute flex items-center justify-center gap-1.5 mt-2"><CheckCircle2 size={13} aria-hidden="true" />Se muestran tus últimos formularios</p>}
    </MovilLayout>
  )
}
