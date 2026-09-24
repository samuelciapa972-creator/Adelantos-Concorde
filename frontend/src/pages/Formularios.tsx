import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { FileText, Plus, Search, CheckCircle2, Pencil, Trash2, Receipt, CalendarDays, Lock, X } from 'lucide-react'

import { useMes } from '../context/MesContext'
import { getFormularios, getConductores, getVehiculos, legalizarFormulario, eliminarFormulario } from '../api'
import { fmt } from '../utils/format'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import BotonesReporte from '../components/ui/BotonesReporte'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import FormularioForm from '../components/ui/FormularioForm'
import GastosForm from '../components/ui/GastosForm'
import type { EstadoFormulario, Formulario } from '../types'

const ESTADOS: { value: EstadoFormulario | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'legalizado', label: 'Legalizados' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'sin_legalizar', label: 'Sin legalizar' },
]

// Saldo a favor de la empresa (verde) o del conductor (rojo); guion si no aplica
function Saldo({ valor, tono }: { valor: number; tono: 'ok' | 'bad' }) {
  if (!(valor > 0)) return <span className="text-line-strong">—</span>
  return <span className={tono === 'ok' ? 'text-ok font-medium' : 'text-bad font-medium'}>{fmt(valor)}</span>
}

type CampoNumerico = 'anticipo' | 'tasa_uso' | 'hospedaje' | 'mantenimiento' | 'saldo_empresa' | 'saldo_empresa_relevador' | 'saldo_conductor' | 'saldo_relevador'
const sumar = (filas: Formulario[], campo: CampoNumerico): number => filas.reduce((s, f) => s + (f[campo] ?? 0), 0)

export default function Formularios() {
  const { mesId, vehiculoId, mes, cerrado } = useMes()
  const qc = useQueryClient()
  const toast = useToast()
  const [searchParams] = useSearchParams()

  const [conductorFilter, setConductorFilter] = useState(searchParams.get('conductor_id') ?? '')
  const [vehiculoFilter, setVehiculoFilter] = useState(searchParams.get('vehiculo_id') ?? '')
  const [estFilter, setEstFilter] = useState<EstadoFormulario | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'nuevo' | Formulario | null>(null)
  const [modalGastos, setModalGastos] = useState<Formulario | null>(null)
  const [aEliminar, setAEliminar] = useState<Formulario | null>(null)

  const { data: formularios = [], isLoading } = useQuery({
    queryKey: ['formularios', mesId, vehiculoId, vehiculoFilter, conductorFilter, estFilter],
    queryFn: () => getFormularios({
      mes_id: mesId,
      vehiculo_id: vehiculoFilter || vehiculoId || undefined,
      conductor_id: conductorFilter || undefined,
      estado: estFilter || undefined,
    }),
    enabled: Boolean(mesId),
  })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: getConductores })
  const { data: vehiculos = [] } = useQuery({ queryKey: ['vehiculos'], queryFn: getVehiculos })

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['formularios'] })
    qc.invalidateQueries({ queryKey: ['resumen'] })
  }

  const legalizar = useMutation({
    mutationFn: legalizarFormulario,
    onSuccess: () => { refrescar(); toast.ok('Formulario legalizado') },
  })
  const eliminar = useMutation({
    mutationFn: eliminarFormulario,
    onSuccess: () => { refrescar(); setAEliminar(null); toast.ok('Formulario eliminado') },
  })

  // Conductores según el vehículo elegido (titular y relevador)
  const vehiculoActivo = vehiculoFilter || vehiculoId
  const conductoresFiltrados = useMemo(() => {
    const activos = conductores.filter((c) => c.activo)
    const v = vehiculoActivo && vehiculos.find((x) => String(x.id) === String(vehiculoActivo))
    if (!v) return activos
    const ids = [v.titular_id, v.relevador_id].filter((x): x is number => x != null)
    return activos.filter((c) => ids.includes(c.id))
  }, [conductores, vehiculos, vehiculoActivo])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return formularios
    return formularios.filter((f) =>
      [f.numero, f.ruta, f.conductor_nombre, f.notas].some((x) => String(x ?? '').toLowerCase().includes(q)))
  }, [formularios, busqueda])

  const hayFiltros = vehiculoFilter || conductorFilter || estFilter || busqueda
  const limpiar = () => { setVehiculoFilter(''); setConductorFilter(''); setEstFilter(''); setBusqueda('') }

  const acciones = (
    <>
      <BotonesReporte />
      {mesId && (
        <button onClick={() => setModal('nuevo')} disabled={cerrado} className="btn-primary" title={cerrado ? 'El mes está cerrado' : undefined}>
          <Plus size={16} aria-hidden="true" /> Nuevo formulario
        </button>
      )}
    </>
  )

  const cabecera = (
    <PageHeader
      title="Formularios"
      icon={FileText}
      actions={acciones}
      subtitle={mes ? (
        <span className="inline-flex items-center gap-2">
          {mes.nombre} {mes.anio} · {visibles.length} registro{visibles.length === 1 ? '' : 's'}
          {cerrado && <span className="chip-mute"><Lock size={11} aria-hidden="true" />Cerrado</span>}
        </span>
      ) : 'Selecciona un mes'}
    />
  )

  if (!mesId) {
    return (
      <>
        {cabecera}
        <div className="panel"><EmptyState icon={CalendarDays} title="Ningún mes seleccionado">Elige un mes en el menú lateral para ver y registrar formularios.</EmptyState></div>
      </>
    )
  }

  return (
    <>
      {cabecera}

      {cerrado && (
        <p className="mb-4 chip-mute !rounded-lg !px-4 !py-2.5 !text-sm w-full">
          <Lock size={14} aria-hidden="true" /> Mes cerrado: los formularios y gastos son de solo lectura. Reábrelo desde el menú lateral para editar.
        </p>
      )}

      {/* Filtros */}
      <div className="panel p-4 mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-end">
          <div>
            <label htmlFor="f-buscar" className="label">Buscar</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
              <input id="f-buscar" className="input pl-9" placeholder="Número, ruta, conductor…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="f-veh" className="label">Vehículo</label>
            <select id="f-veh" className="select" value={vehiculoFilter} onChange={(e) => { setVehiculoFilter(e.target.value); setConductorFilter('') }}>
              <option value="">Todos</option>
              {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.numero_interno} — {v.placa}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-cond" className="label">Conductor</label>
            <select id="f-cond" className="select" value={conductorFilter} onChange={(e) => setConductorFilter(e.target.value)}>
              <option value="">Todos</option>
              {conductoresFiltrados.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-est" className="label">Estado</label>
            <select id="f-est" className="select" value={estFilter} onChange={(e) => setEstFilter(e.target.value as EstadoFormulario | '')}>
              {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          {hayFiltros && (
            <button onClick={limpiar} className="btn-ghost"><X size={15} aria-hidden="true" /> Limpiar</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <section className="panel overflow-hidden" aria-label="Listado de formularios">
        {isLoading ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={hayFiltros ? 'Sin resultados' : 'Aún no hay formularios'}
            action={hayFiltros
              ? <button className="btn-secondary" onClick={limpiar}>Limpiar filtros</button>
              : !cerrado && <button className="btn-primary" onClick={() => setModal('nuevo')}><Plus size={16} /> Nuevo formulario</button>}
          >
            {hayFiltros ? 'Ningún formulario coincide con los filtros aplicados.' : 'Registra el primer anticipo de este mes.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>N° Cuenta</th>
                  <th>Ruta</th>
                  <th className="!text-right">Anticipo</th>
                  <th className="!text-right">Tasa uso</th>
                  <th className="!text-right">Hospedaje</th>
                  <th className="!text-right">Mantenim.</th>
                  <th className="!text-right" title="A favor de la empresa — titular">Saldo empresa</th>
                  <th className="!text-right" title="A favor de la empresa — relevador">Saldo empresa 2</th>
                  <th className="!text-right" title="A favor del conductor titular">A favor conductor</th>
                  <th className="!text-right" title="A favor del relevador">A favor relevador</th>
                  <th>Estado</th>
                  <th>Conductor</th>
                  <th>Relevador</th>
                  <th className="sticky right-0 z-10 !bg-[#EDEDF2] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="group">
                    <td className="text-ink-mute tabular-nums">{f.fecha_dia}</td>
                    <td className="font-medium tabular-nums">{f.numero}</td>
                    <td className="text-ink-soft max-w-[14rem] truncate" title={f.ruta ?? undefined}>{f.ruta || '—'}</td>
                    <td className="num font-medium">{fmt(f.anticipo)}</td>
                    <td className="num text-ink-soft">{fmt(f.tasa_uso)}</td>
                    <td className="num text-ink-soft">{f.hospedaje > 0 ? fmt(f.hospedaje) : '—'}</td>
                    <td className="num text-ink-soft">{f.mantenimiento > 0 ? fmt(f.mantenimiento) : '—'}</td>
                    <td className="num"><Saldo valor={f.saldo_empresa} tono="ok" /></td>
                    <td className="num"><Saldo valor={f.saldo_empresa_relevador} tono="ok" /></td>
                    <td className="num"><Saldo valor={f.saldo_conductor} tono="bad" /></td>
                    <td className="num"><Saldo valor={f.saldo_relevador} tono="bad" /></td>
                    <td><Badge estado={f.estado} /></td>
                    <td className="text-ink-soft">{f.conductor_nombre ?? '—'}</td>
                    <td className="text-ink-mute">{f.relevador_nombre ?? '—'}</td>
                    <td className="sticky right-0 z-10 bg-surface-raised group-hover:bg-[#FAFAFC] shadow-[-8px_0_8px_-8px_rgb(21_20_31/0.12)]">
                      <div className="flex justify-center gap-0.5">
                        {f.estado !== 'legalizado' ? (
                          <button onClick={() => legalizar.mutate(f.id)} disabled={cerrado || legalizar.isPending} className="btn-icon hover:!text-ok" title="Legalizar" aria-label={`Legalizar formulario ${f.numero}`}>
                            <CheckCircle2 size={16} />
                          </button>
                        ) : <span className="w-8 h-8" aria-hidden="true" />}
                        <button onClick={() => setModalGastos(f)} className="btn-icon" title="Gastos y soportes" aria-label={`Gastos del formulario ${f.numero}`}>
                          <Receipt size={16} />
                        </button>
                        <button onClick={() => setModal(f)} disabled={cerrado} className="btn-icon" title="Editar" aria-label={`Editar formulario ${f.numero}`}>
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => setAEliminar(f)} disabled={cerrado} className="btn-icon hover:!text-bad hover:!bg-bad-soft" title="Eliminar" aria-label={`Eliminar formulario ${f.numero}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Totales ({visibles.length})</td>
                  <td className="num">{fmt(sumar(visibles, 'anticipo'))}</td>
                  <td className="num">{fmt(sumar(visibles, 'tasa_uso'))}</td>
                  <td className="num">{fmt(sumar(visibles, 'hospedaje'))}</td>
                  <td className="num">{fmt(sumar(visibles, 'mantenimiento'))}</td>
                  <td className="num text-ok">{fmt(sumar(visibles, 'saldo_empresa'))}</td>
                  <td className="num text-ok">{fmt(sumar(visibles, 'saldo_empresa_relevador'))}</td>
                  <td className="num text-bad">{fmt(sumar(visibles, 'saldo_conductor'))}</td>
                  <td className="num text-bad">{fmt(sumar(visibles, 'saldo_relevador'))}</td>
                  <td colSpan={3} />
                  <td className="sticky right-0 z-10 !bg-[#EDEDF2]" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo formulario' : `Editar formulario ${modal.numero}`} onClose={() => setModal(null)} size="lg">
          <FormularioForm formulario={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} />
        </Modal>
      )}

      {modalGastos && (
        <Modal title={`Gastos · formulario ${modalGastos.numero} · ${modalGastos.conductor_nombre}`} onClose={() => setModalGastos(null)} size="xl">
          <GastosForm formulario={modalGastos} readOnly={cerrado} />
        </Modal>
      )}

      {aEliminar && (
        <ConfirmDialog
          title="Eliminar formulario"
          message={`Se eliminará el formulario ${aEliminar.numero} junto con todos sus gastos y soportes. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          busy={eliminar.isPending}
          onConfirm={() => eliminar.mutate(aEliminar.id)}
          onCancel={() => setAEliminar(null)}
        />
      )}
    </>
  )
}
