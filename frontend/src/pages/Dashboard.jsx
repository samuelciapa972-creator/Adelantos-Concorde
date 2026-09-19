import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Banknote, Receipt, Scale, TriangleAlert, LayoutDashboard, CalendarDays, Lock, ArrowRight } from 'lucide-react'

import { useMes } from '../context/MesContext'
import { getResumenMes } from '../api'
import { fmt } from '../utils/format'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import EmptyState from '../components/ui/EmptyState'
import { PageSkeleton } from '../components/ui/Skeleton'
import BotonesReporte from '../components/ui/BotonesReporte'
import BarChart from '../components/charts/BarChart'
import StatusBars from '../components/charts/StatusBars'

export default function Dashboard() {
  const { mesId, vehiculoId, mes, cerrado } = useMes()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['resumen', mesId, vehiculoId],
    queryFn: () => getResumenMes(mesId, vehiculoId),
    enabled: Boolean(mesId),
  })

  const resumen = data?.resumen ?? []

  const t = useMemo(() => resumen.reduce((a, r) => ({
    formularios: a.formularios + (r.total_formularios ?? 0),
    anticipo: a.anticipo + (r.total_anticipo ?? 0),
    facturas: a.facturas + (r.total_facturas ?? 0),
    saldo: a.saldo + (r.saldo_real ?? 0),
    sin: a.sin + (r.sin_legalizar ?? 0),
    pend: a.pend + (r.con_pendiente ?? 0),
  }), { formularios: 0, anticipo: 0, facturas: 0, saldo: 0, sin: 0, pend: 0 }), [resumen])

  const datosGrafico = resumen.map((r) => ({
    label: r.vehiculo,
    detalle: r.placa,
    valores: [r.total_anticipo ?? 0, r.total_facturas ?? 0],
  }))

  const subtitulo = mes ? (
    <span className="inline-flex items-center gap-2">
      {mes.nombre} {mes.anio}
      {cerrado && <span className="chip-mute"><Lock size={11} aria-hidden="true" />Cerrado</span>}
    </span>
  ) : 'Selecciona un mes'

  const cabecera = <PageHeader title="Panel general" subtitle={subtitulo} icon={LayoutDashboard} actions={<BotonesReporte />} />

  if (!mesId) {
    return (
      <>
        {cabecera}
        <div className="panel">
          <EmptyState icon={CalendarDays} title="Aún no hay un mes activo">
            Crea el primer mes con el botón «Nuevo» del menú lateral para empezar a registrar formularios.
          </EmptyState>
        </div>
      </>
    )
  }

  if (isLoading) return <PageSkeleton />

  if (isError) {
    return (
      <>
        {cabecera}
        <div className="panel p-6 text-bad" role="alert">No se pudo cargar el resumen: {error.message}</div>
      </>
    )
  }

  const porLegalizar = t.sin + t.pend
  const saldoAbs = Math.abs(t.saldo)

  return (
    <>
      {cabecera}

      <section aria-label="Indicadores del mes" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Banknote} label="Anticipado" value={fmt(t.anticipo)} hint={`${t.formularios} formulario${t.formularios === 1 ? '' : 's'}`} />
        <StatCard icon={Receipt} label="Facturado" value={fmt(t.facturas)} hint="Tasa de uso, hospedaje, mantenimiento y gastos" />
        <StatCard
          icon={Scale}
          label="Saldo neto"
          value={fmt(saldoAbs)}
          tone={t.saldo === 0 ? 'neutral' : t.saldo > 0 ? 'ok' : 'bad'}
          hint={t.saldo === 0 ? 'Cuentas en cero' : t.saldo > 0 ? 'A favor de la empresa' : 'A favor de los conductores'}
        />
        <StatCard
          icon={TriangleAlert}
          label="Por legalizar"
          value={porLegalizar}
          tone={t.sin > 0 ? 'bad' : t.pend > 0 ? 'warn' : 'ok'}
          hint={porLegalizar === 0 ? 'Todo legalizado' : `${t.sin} sin legalizar · ${t.pend} pendientes`}
        />
      </section>

      {resumen.length > 0 && (
        <section className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6">
          <div className="panel p-5 xl:col-span-3">
            <h2 className="text-xl font-semibold text-ink">Anticipos frente a facturas</h2>
            <p className="text-sm text-ink-mute mt-0.5 mb-4">Por vehículo. Si las facturas superan el anticipo, la empresa debe al conductor.</p>
            <BarChart
              data={datosGrafico}
              series={['Anticipo', 'Facturas']}
              ariaLabel="Anticipos y facturas por vehículo. Los valores exactos están en la tabla inferior."
            />
          </div>

          <div className="panel p-5 xl:col-span-2">
            <h2 className="text-xl font-semibold text-ink">Estado de legalización</h2>
            <p className="text-sm text-ink-mute mt-0.5 mb-4">Formularios del mes por vehículo.</p>
            <StatusBars filas={resumen} />
          </div>
        </section>
      )}

      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="text-xl font-semibold text-ink">Resumen por vehículo</h2>
            <p className="text-sm text-ink-mute">Titular, relevador y saldos del mes.</p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Vehículo</th>
                <th>Titular</th>
                <th>Relevador</th>
                <th className="!text-right">Formularios</th>
                <th className="!text-right">Anticipo</th>
                <th className="!text-right">Facturas</th>
                <th className="!text-right">Saldo</th>
                <th className="!text-right">Por legalizar</th>
                <th><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => {
                const saldo = r.saldo_real ?? 0
                const pendientes = (r.sin_legalizar ?? 0) + (r.con_pendiente ?? 0)
                return (
                  <tr key={r.vehiculo_id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="font-display font-semibold text-lg leading-none">{r.vehiculo}</span>
                        <span className="chip-mute font-mono text-[11px] tracking-wider">{r.placa ?? 'SIN PLACA'}</span>
                      </div>
                    </td>
                    <td className="text-ink-soft max-w-[10rem] truncate" title={r.titular ?? undefined}>{r.titular ?? '—'}</td>
                    <td className="text-ink-soft max-w-[10rem] truncate" title={r.relevador ?? undefined}>{r.relevador ?? '—'}</td>
                    <td className="num">{r.total_formularios ?? 0}</td>
                    <td className="num">{fmt(r.total_anticipo ?? 0)}</td>
                    <td className="num">{fmt(r.total_facturas ?? 0)}</td>
                    <td className={`num font-semibold ${saldo > 0 ? 'text-ok' : saldo < 0 ? 'text-bad' : 'text-ink-mute'}`}>
                      {fmt(saldo)}
                      <span className="block text-[11px] font-normal text-ink-mute">
                        {saldo > 0 ? 'a favor empresa' : saldo < 0 ? 'a favor conductor' : ''}
                      </span>
                    </td>
                    <td className="num">
                      {pendientes > 0
                        ? <span className={r.sin_legalizar > 0 ? 'chip-bad' : 'chip-warn'}>{pendientes}</span>
                        : <span className="text-ink-mute">—</span>}
                    </td>
                    <td className="text-right">
                      <Link to={`/formularios?vehiculo_id=${r.vehiculo_id}`} className="btn-ghost btn-sm" aria-label={`Ver formularios del bus ${r.vehiculo}`}>
                        Ver <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {resumen.length === 0 && (
                <tr><td colSpan={9} className="!whitespace-normal"><EmptyState title="Sin vehículos">No hay vehículos activos que mostrar.</EmptyState></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
