import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { getConductores, getVehiculos, getMeses, crearFormulario, actualizarFormulario } from '../../api'
import { useMes } from '../../context/MesContext'
import { useToast } from './Toast'
import Field from './Field'

const ESTADOS = [
  { value: 'sin_legalizar', label: 'Sin legalizar' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'legalizado', label: 'Legalizado' },
]

function Seccion({ titulo, children }) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute mb-3 p-0">{titulo}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">{children}</div>
    </fieldset>
  )
}

export default function FormularioForm({ formulario, onClose }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { mesId, vehiculoId } = useMes()
  const isEdit = Boolean(formulario?.id)

  const { data: conductores = [] } = useQuery({ queryKey: ['conductores'], queryFn: getConductores })
  const { data: vehiculos = [] } = useQuery({ queryKey: ['vehiculos'], queryFn: getVehiculos })
  const { data: meses = [] } = useQuery({ queryKey: ['meses'], queryFn: getMeses })

  const [form, setForm] = useState({
    numero: formulario?.numero ?? '',
    fecha_dia: formulario?.fecha_dia ?? '',
    conductor_id: formulario?.conductor_id ?? '',
    vehiculo_id: formulario?.vehiculo_id ?? (vehiculoId ?? ''),
    mes_id: formulario?.mes_id ?? (mesId ?? ''),
    fecha_salida: formulario?.fecha_salida ?? '',
    fecha_regreso: formulario?.fecha_regreso ?? '',
    anticipo: formulario?.anticipo ?? '',
    tasa_uso: formulario?.tasa_uso ?? '',
    hospedaje: formulario?.hospedaje ?? '',
    mantenimiento: formulario?.mantenimiento ?? '',
    ruta: formulario?.ruta ?? '',
    estado: formulario?.estado ?? 'sin_legalizar',
    notas: formulario?.notas ?? '',
  })

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  // Al elegir el vehículo, el conductor se limita a su titular y relevador
  const vehiculo = vehiculos.find((v) => String(v.id) === String(form.vehiculo_id))
  const opcionesConductor = useMemo(() => {
    const activos = conductores.filter((c) => c.activo || c.id === formulario?.conductor_id)
    const ids = vehiculo ? [vehiculo.titular_id, vehiculo.relevador_id].filter(Boolean) : []
    return ids.length ? activos.filter((c) => ids.includes(c.id) || c.id === formulario?.conductor_id) : activos
  }, [conductores, vehiculo, formulario])

  function cambiarVehiculo(e) {
    const id = e.target.value
    const v = vehiculos.find((x) => String(x.id) === String(id))
    setForm((f) => ({
      ...f,
      vehiculo_id: id,
      // Si el conductor actual no pertenece al nuevo vehículo, se propone el titular
      conductor_id: v && ![v.titular_id, v.relevador_id].includes(Number(f.conductor_id)) ? (v.titular_id ?? '') : f.conductor_id,
    }))
  }

  const mutation = useMutation({
    mutationFn: (data) => (isEdit ? actualizarFormulario(formulario.id, data) : crearFormulario(data)),
    meta: { inline: true },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['formularios'] })
      qc.invalidateQueries({ queryKey: ['resumen'] })
      toast.ok(isEdit ? 'Formulario actualizado' : 'Formulario creado')
      onClose()
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    mutation.mutate({
      numero: form.numero.trim(),
      fecha_dia: Number(form.fecha_dia),
      conductor_id: Number(form.conductor_id),
      vehiculo_id: Number(form.vehiculo_id),
      mes_id: Number(form.mes_id),
      fecha_salida: form.fecha_salida || null,
      fecha_regreso: form.fecha_regreso || null,
      anticipo: Number(form.anticipo),
      tasa_uso: Number(form.tasa_uso) || 0,
      hospedaje: Number(form.hospedaje) || 0,
      mantenimiento: Number(form.mantenimiento) || 0,
      ruta: form.ruta.trim(),
      estado: form.estado,
      notas: form.notas.trim(),
    })
  }

  const dinero = { type: 'number', min: 0, step: 1, inputMode: 'numeric', className: 'input tabular-nums' }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Seccion titulo="Identificación">
        <Field label="Número de formulario" required>
          {(id) => <input id={id} className="input" value={form.numero} onChange={set('numero')} maxLength={50} required autoFocus />}
        </Field>
        <Field label="Día del mes" required>
          {(id) => <input id={id} className="input" type="number" min={1} max={31} value={form.fecha_dia} onChange={set('fecha_dia')} required />}
        </Field>
        <Field label="Vehículo" required>
          {(id) => (
            <select id={id} className="select" value={form.vehiculo_id} onChange={cambiarVehiculo} required>
              <option value="">Seleccionar…</option>
              {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.numero_interno} — {v.placa}</option>)}
            </select>
          )}
        </Field>
        <Field label="Conductor" required hint={vehiculo ? 'Titular o relevador del vehículo elegido.' : undefined}>
          {(id) => (
            <select id={id} className="select" value={form.conductor_id} onChange={set('conductor_id')} required>
              <option value="">Seleccionar…</option>
              {opcionesConductor.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
        </Field>
        <Field label="Mes" required>
          {(id) => (
            <select id={id} className="select" value={form.mes_id} onChange={set('mes_id')} required>
              <option value="">Seleccionar…</option>
              {meses.map((m) => (
                <option key={m.id} value={m.id} disabled={Boolean(m.cerrado) && m.id !== formulario?.mes_id}>
                  {m.nombre} {m.anio}{m.cerrado ? ' (cerrado)' : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Estado">
          {(id) => (
            <select id={id} className="select" value={form.estado} onChange={set('estado')}>
              {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          )}
        </Field>
      </Seccion>

      <Seccion titulo="Recorrido">
        <Field label="Fecha de salida">
          {(id) => <input id={id} type="date" className="input" value={form.fecha_salida} onChange={set('fecha_salida')} />}
        </Field>
        <Field label="Fecha de regreso">
          {(id) => <input id={id} type="date" className="input" min={form.fecha_salida || undefined} value={form.fecha_regreso} onChange={set('fecha_regreso')} />}
        </Field>
        <Field label="Ruta" className="sm:col-span-2">
          {(id) => <input id={id} className="input" value={form.ruta} onChange={set('ruta')} maxLength={200} placeholder="Ej.: Bogotá – Cúcuta" />}
        </Field>
      </Seccion>

      <Seccion titulo="Valores (COP)">
        <Field label="Anticipo" required>
          {(id) => <input id={id} {...dinero} value={form.anticipo} onChange={set('anticipo')} required />}
        </Field>
        <Field label="Tasa de uso">
          {(id) => <input id={id} {...dinero} value={form.tasa_uso} onChange={set('tasa_uso')} placeholder="0" />}
        </Field>
        <Field label="Hospedaje">
          {(id) => <input id={id} {...dinero} value={form.hospedaje} onChange={set('hospedaje')} placeholder="0" />}
        </Field>
        <Field label="Mantenimiento">
          {(id) => <input id={id} {...dinero} value={form.mantenimiento} onChange={set('mantenimiento')} placeholder="0" />}
        </Field>
      </Seccion>

      <Field label="Notas" hint={`${form.notas.length}/500`}>
        {(id) => <textarea id={id} className="input" rows={3} maxLength={500} value={form.notas} onChange={set('notas')} />}
      </Field>

      {mutation.isError && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{mutation.error.message}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear formulario'}
        </button>
      </div>
    </form>
  )
}
