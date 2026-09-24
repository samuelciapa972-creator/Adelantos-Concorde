import { useState, type ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BusFront, User, Users, Plus, Pencil, Trash2, type LucideIcon } from 'lucide-react'

import { getVehiculos, getConductores, crearVehiculo, actualizarVehiculo, asignarConductores, eliminarVehiculo } from '../api'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Field from '../components/ui/Field'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import type { Conductor, Vehiculo } from '../types'

const texto = (v: number | null | undefined): string => (v == null ? '' : String(v))

interface FormProps {
  /** null para crear uno nuevo. */
  vehiculo: Vehiculo | null
  conductores: Conductor[]
  onClose: () => void
}

function VehiculoForm({ vehiculo, conductores, onClose }: FormProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const isEdit = Boolean(vehiculo?.id)

  const [form, setForm] = useState({
    numero_interno: vehiculo?.numero_interno ?? '',
    placa: vehiculo?.placa ?? '',
    marca: vehiculo?.marca ?? '',
    modelo: vehiculo?.modelo ?? '',
    color: vehiculo?.color ?? '',
    titular_id: texto(vehiculo?.titular_id),
    relevador_id: texto(vehiculo?.relevador_id),
  })
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const igual = Boolean(form.titular_id) && form.titular_id === form.relevador_id

  const guardar = useMutation({
    meta: { inline: true },
    mutationFn: async () => {
      const datos = {
        numero_interno: form.numero_interno.trim(),
        placa: form.placa.trim(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        color: form.color.trim() || null,
      }
      let id: number
      if (vehiculo) {
        await actualizarVehiculo(vehiculo.id, datos)
        id = vehiculo.id
      } else {
        id = (await crearVehiculo(datos)).id
      }
      await asignarConductores(id, {
        titular_id: form.titular_id ? Number(form.titular_id) : null,
        relevador_id: form.relevador_id ? Number(form.relevador_id) : null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehiculos'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      toast.ok(isEdit ? 'Vehículo actualizado' : 'Vehículo creado')
      onClose()
    },
  })

  const activos = conductores.filter((c) => c.activo || [vehiculo?.titular_id, vehiculo?.relevador_id].includes(c.id))

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!igual) guardar.mutate() }} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Número interno" required hint="Identifica al bus y a su cuenta contable.">
          {(id) => <input id={id} className="input" value={form.numero_interno} onChange={set('numero_interno')} maxLength={20} placeholder="33000" required autoFocus />}
        </Field>
        <Field label="Placa" required>
          {(id) => <input id={id} className="input font-mono uppercase" value={form.placa} onChange={set('placa')} maxLength={20} placeholder="ABC-123" required />}
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Marca">{(id) => <input id={id} className="input" value={form.marca} onChange={set('marca')} placeholder="Scania" />}</Field>
        <Field label="Modelo">{(id) => <input id={id} className="input" value={form.modelo} onChange={set('modelo')} placeholder="K360" />}</Field>
        <Field label="Color">{(id) => <input id={id} className="input" value={form.color} onChange={set('color')} placeholder="Blanco" />}</Field>
      </div>

      <fieldset className="border-0 border-t border-line pt-4 m-0 px-0 pb-0">
        <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute pr-2">Conductores asignados</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <Field label="Titular">
            {(id) => (
              <select id={id} className="select" value={form.titular_id} onChange={set('titular_id')}>
                <option value="">Sin asignar</option>
                {activos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            )}
          </Field>
          <Field label="Relevador">
            {(id) => (
              <select id={id} className="select" value={form.relevador_id} onChange={set('relevador_id')}>
                <option value="">Sin asignar</option>
                {activos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            )}
          </Field>
        </div>
        {igual && <p role="alert" className="field-error">El titular y el relevador deben ser distintos.</p>}
      </fieldset>

      {guardar.isError && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{guardar.error.message}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={guardar.isPending || igual}>
          {guardar.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear vehículo'}
        </button>
      </div>
    </form>
  )
}

function Persona({ icono: Icono, rol, nombre }: { icono: LucideIcon; rol: string; nombre: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-sunken text-ink-soft flex items-center justify-center shrink-0"><Icono size={14} aria-hidden="true" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-ink-mute">{rol}</p>
        <p className={`text-sm truncate ${nombre ? 'font-medium text-ink' : 'text-ink-mute'}`}>{nombre ?? 'Sin asignar'}</p>
      </div>
    </div>
  )
}

export default function Vehiculos() {
  const qc = useQueryClient()
  const toast = useToast()
  const [modal, setModal] = useState<'nuevo' | Vehiculo | null>(null)
  const [aEliminar, setAEliminar] = useState<Vehiculo | null>(null)

  const { data: vehiculos = [], isLoading } = useQuery({ queryKey: ['vehiculos'], queryFn: getVehiculos })
  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: getConductores })

  const eliminar = useMutation({
    mutationFn: eliminarVehiculo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vehiculos'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      setAEliminar(null)
      toast.ok('Vehículo dado de baja')
    },
  })

  return (
    <>
      <PageHeader
        title="Vehículos"
        icon={BusFront}
        subtitle={`${vehiculos.length} vehículo${vehiculos.length === 1 ? '' : 's'} activo${vehiculos.length === 1 ? '' : 's'}`}
        actions={<button className="btn-primary" onClick={() => setModal('nuevo')}><Plus size={16} aria-hidden="true" /> Nuevo vehículo</button>}
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
      ) : vehiculos.length === 0 ? (
        <div className="panel">
          <EmptyState icon={BusFront} title="Sin vehículos" action={<button className="btn-primary" onClick={() => setModal('nuevo')}><Plus size={16} /> Crear el primero</button>}>
            Registra los buses para asignarles conductores y formularios.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 list-none p-0 m-0">
          {vehiculos.map((v) => (
            <li key={v.id} className="panel overflow-hidden flex flex-col">
              <div className="flex items-start justify-between gap-3 px-5 pt-5">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-ink-mute">Bus</p>
                  <p className="font-display font-semibold text-[36px] leading-none text-ink">{v.numero_interno}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {/* Placa con aire de matrícula */}
                  <span className="font-mono text-sm font-semibold tracking-[0.18em] bg-[#F6D24A] text-[#1B1A10] border-2 border-[#1B1A10] rounded-md px-2.5 py-0.5">{v.placa}</span>
                  <div className="flex">
                    <button onClick={() => setModal(v)} className="btn-icon" title="Editar" aria-label={`Editar vehículo ${v.numero_interno}`}><Pencil size={15} /></button>
                    <button onClick={() => setAEliminar(v)} className="btn-icon hover:!text-bad hover:!bg-bad-soft" title="Dar de baja" aria-label={`Dar de baja el vehículo ${v.numero_interno}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 space-y-3 flex-1">
                <Persona icono={User} rol="Titular" nombre={v.titular} />
                <Persona icono={Users} rol="Relevador" nombre={v.relevador} />
              </div>

              <div className="px-5 py-3 border-t border-line bg-surface-sunken/50 text-xs text-ink-soft flex flex-wrap gap-x-4 gap-y-1">
                {[v.marca, v.modelo, v.color].filter(Boolean).length
                  ? [v.marca, v.modelo, v.color].filter(Boolean).map((x) => <span key={x}>{x}</span>)
                  : <span className="text-ink-mute">Sin datos del vehículo</span>}
                <span className="ml-auto text-ink-mute">Cuenta {v.cuenta_codigo}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo vehículo' : `Editar vehículo ${modal.numero_interno}`} onClose={() => setModal(null)} size="md">
          <VehiculoForm vehiculo={modal === 'nuevo' ? null : modal} conductores={conductores} onClose={() => setModal(null)} />
        </Modal>
      )}

      {aEliminar && (
        <ConfirmDialog
          title="Dar de baja vehículo"
          message={`El vehículo ${aEliminar.numero_interno} (${aEliminar.placa}) dejará de aparecer en los listados. Sus formularios anteriores se conservan.`}
          confirmLabel="Dar de baja"
          busy={eliminar.isPending}
          onConfirm={() => eliminar.mutate(aEliminar.id)}
          onCancel={() => setAEliminar(null)}
        />
      )}
    </>
  )
}
