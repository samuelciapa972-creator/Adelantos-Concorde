import { useMemo, useState, type ChangeEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Plus, Pencil, UserX, UserCheck, Search, Smartphone, Copy, Check, RefreshCw, KeyRound } from 'lucide-react'

import {
  getConductores, getVehiculos, crearConductor, actualizarConductor, eliminarConductor,
  getUsuarios, crearUsuarioConductor, restablecerPassword, cambiarAccesoUsuario,
} from '../api'
import { iniciales } from '../utils/format'
import { generarPassword, sugerirUsuario } from '../utils/imagen'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Field from '../components/ui/Field'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import type { Bit, Conductor, CuentaConductor, RolVehiculo } from '../types'

function ConductorForm({ conductor, onClose }: { conductor: Conductor | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const isEdit = Boolean(conductor?.id)
  const [f, setF] = useState<{ nombre: string; iniciales: string; licencia: string; tipo: RolVehiculo }>({
    nombre: conductor?.nombre ?? '',
    iniciales: conductor?.iniciales ?? '',
    licencia: conductor?.licencia ?? '',
    tipo: conductor?.tipo ?? 'titular',
  })
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }))

  const guardar = useMutation({
    meta: { inline: true },
    mutationFn: async () => {
      const datos = {
        nombre: f.nombre.trim(),
        iniciales: f.iniciales.trim() || undefined,
        licencia: f.licencia.trim() || null,
        tipo: f.tipo,
      }
      if (conductor) await actualizarConductor(conductor.id, datos)
      else await crearConductor(datos)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conductores'] })
      qc.invalidateQueries({ queryKey: ['vehiculos'] })
      toast.ok(isEdit ? 'Conductor actualizado' : 'Conductor creado')
      onClose()
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <Field label="Nombre completo" required>
        {(id) => <input id={id} className="input" value={f.nombre} onChange={set('nombre')} minLength={2} maxLength={100} required autoFocus />}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Iniciales" hint="Si se deja vacío se generan del nombre.">
          {(id) => <input id={id} className="input uppercase" value={f.iniciales} onChange={set('iniciales')} maxLength={5} placeholder={iniciales(f.nombre) || 'AB'} />}
        </Field>
        <Field label="Licencia">
          {(id) => <input id={id} className="input" value={f.licencia} onChange={set('licencia')} maxLength={40} />}
        </Field>
      </div>
      <Field label="Tipo habitual">
        {(id) => (
          <select id={id} className="select" value={f.tipo} onChange={set('tipo')}>
            <option value="titular">Titular</option>
            <option value="relevador">Relevador</option>
          </select>
        )}
      </Field>
      <p className="hint -mt-1">El vehículo y el rol concretos se asignan desde la sección Vehículos.</p>

      {guardar.isError && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{guardar.error.message}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear conductor'}</button>
      </div>
    </form>
  )
}

/** Crear el acceso a la app móvil de un conductor, o restablecer su contraseña. */
interface AccesoProps {
  conductor: Conductor
  /** Cuenta existente (restablecer contraseña) o null (crear el acceso). */
  cuenta: CuentaConductor | null
  onClose: () => void
}

function AccesoApp({ conductor, cuenta, onClose }: AccesoProps) {
  const qc = useQueryClient()
  const toast = useToast()
  const restablecer = Boolean(cuenta)
  const [usuario, setUsuario] = useState(cuenta?.usuario ?? sugerirUsuario(conductor.nombre))
  const [password, setPassword] = useState(generarPassword())
  const [ver, setVer] = useState(true)
  const [entregado, setEntregado] = useState<{ usuario: string; password: string } | null>(null) // credenciales para mostrar una sola vez
  const [copiado, setCopiado] = useState(false)

  const guardar = useMutation({
    meta: { inline: true },
    mutationFn: async () => {
      if (cuenta) await restablecerPassword(cuenta.id, password)
      else await crearUsuarioConductor({ conductor_id: conductor.id, usuario: usuario.trim(), password })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      toast.ok(restablecer ? 'Contraseña restablecida' : 'Acceso creado')
      setEntregado({ usuario: usuario.trim(), password })
    },
  })

  const texto = entregado
    ? `Viáticos VH\nAbre: ${window.location.origin}\nUsuario: ${entregado.usuario}\nContraseña temporal: ${entregado.password}\n(Te pedirá cambiarla al ingresar.)`
    : ''

  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }
    catch { toast.error('No se pudo copiar. Selecciona el texto y cópialo a mano.') }
  }

  if (entregado) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">Entrega estos datos a <strong>{conductor.nombre}</strong>. La contraseña es temporal: la app le pedirá cambiarla en su primer ingreso. <strong>No se volverá a mostrar.</strong></p>
        <pre className="bg-surface-sunken border border-line rounded-lg p-4 text-sm whitespace-pre-wrap select-all font-sans">{texto}</pre>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={copiar}>{copiado ? <Check size={15} /> : <Copy size={15} />}{copiado ? 'Copiado' : 'Copiar datos'}</button>
          <button className="btn-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar.mutate() }} className="space-y-4">
      <p className="text-sm text-ink-soft">
        {restablecer ? <>Se generará una contraseña temporal nueva para <strong>{conductor.nombre}</strong> y se cerrarán sus sesiones abiertas.</>
          : <>Crea el usuario con el que <strong>{conductor.nombre}</strong> entrará a la app del celular para subir sus soportes.</>}
      </p>
      <Field label="Usuario" hint="Sin espacios. Es lo que el conductor escribe al ingresar.">
        {(id) => <input id={id} className="input" value={usuario} onChange={(e) => setUsuario(e.target.value)} disabled={restablecer}
          pattern="[A-Za-z0-9._\-]{3,50}" title="Letras, números, punto, guion y guion bajo (3 a 50)" autoCapitalize="none" spellCheck={false} required />}
      </Field>
      <Field label="Contraseña temporal" hint="Mínimo 10 caracteres. El conductor deberá cambiarla al entrar.">
        {(id) => (
          <div className="flex gap-2">
            <input id={id} type={ver ? 'text' : 'password'} className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setPassword(generarPassword())} title="Generar otra"><RefreshCw size={15} aria-hidden="true" />Generar</button>
          </div>
        )}
      </Field>
      {guardar.isError && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{guardar.error.message}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="btn-primary" disabled={guardar.isPending}>{guardar.isPending ? 'Guardando…' : restablecer ? 'Restablecer contraseña' : 'Crear acceso'}</button>
      </div>
    </form>
  )
}

export default function Conductores() {
  const qc = useQueryClient()
  const toast = useToast()
  const [modal, setModal] = useState<'nuevo' | Conductor | null>(null)
  const [aDesactivar, setADesactivar] = useState<Conductor | null>(null)
  const [verInactivos, setVerInactivos] = useState(false)
  const [q, setQ] = useState('')
  const [acceso, setAcceso] = useState<{ conductor: Conductor; cuenta: CuentaConductor | null } | null>(null)

  const { data: conductores = [], isLoading } = useQuery({ queryKey: ['conductores'], queryFn: getConductores })
  const { data: vehiculos = [] } = useQuery({ queryKey: ['vehiculos'], queryFn: getVehiculos })
  const { data: cuentas = [] } = useQuery({ queryKey: ['usuarios'], queryFn: getUsuarios })
  const cuentaDe = (id: number) => cuentas.find((u) => u.conductor_id === id)

  // Dónde trabaja cada conductor: { conductor_id: [{ bus, rol }] }
  const asignaciones = useMemo(() => {
    const m: Record<number, { bus: string; rol: string }[]> = {}
    vehiculos.forEach((v) => {
      if (v.titular_id) (m[v.titular_id] ??= []).push({ bus: v.numero_interno, rol: 'Titular' })
      if (v.relevador_id) (m[v.relevador_id] ??= []).push({ bus: v.numero_interno, rol: 'Relevador' })
    })
    return m
  }, [vehiculos])

  const invalidar = () => { qc.invalidateQueries({ queryKey: ['conductores'] }); qc.invalidateQueries({ queryKey: ['vehiculos'] }); qc.invalidateQueries({ queryKey: ['resumen'] }) }

  const desactivar = useMutation({
    mutationFn: eliminarConductor,
    onSuccess: () => { invalidar(); setADesactivar(null); toast.ok('Conductor desactivado y liberado de sus vehículos') },
  })
  const alternarAcceso = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: Bit }) => cambiarAccesoUsuario(id, activo),
    onSuccess: (_, { activo }) => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.ok(activo ? 'Acceso reactivado' : 'Acceso desactivado') },
  })
  const reactivar = useMutation({
    mutationFn: (id: number) => actualizarConductor(id, { activo: 1 }),
    onSuccess: () => { invalidar(); toast.ok('Conductor reactivado') },
  })

  const lista = conductores.filter((c) => {
    if (!verInactivos && !c.activo) return false
    const t = q.trim().toLowerCase()
    return !t || `${c.nombre} ${c.licencia ?? ''}`.toLowerCase().includes(t)
  })
  const inactivos = conductores.filter((c) => !c.activo).length

  return (
    <>
      <PageHeader
        title="Conductores"
        icon={Users}
        subtitle={`${conductores.length - inactivos} activo${conductores.length - inactivos === 1 ? '' : 's'}${inactivos ? ` · ${inactivos} inactivo${inactivos === 1 ? '' : 's'}` : ''}`}
        actions={<button className="btn-primary" onClick={() => setModal('nuevo')}><Plus size={16} aria-hidden="true" /> Nuevo conductor</button>}
      />

      <div className="panel p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <label htmlFor="c-buscar" className="sr-only">Buscar conductor</label>
          <input id="c-buscar" className="input pl-9" placeholder="Buscar por nombre o licencia…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {inactivos > 0 && (
          <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-brand-500" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
        )}
      </div>

      <section className="panel overflow-hidden" aria-label="Listado de conductores">
        {isLoading ? (
          <div className="p-5 space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : lista.length === 0 ? (
          <EmptyState icon={Users} title={q ? 'Sin resultados' : 'Sin conductores'}>
            {q ? 'Ningún conductor coincide con la búsqueda.' : 'Registra a los conductores para poder asignarlos a los buses.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Conductor</th><th>Licencia</th><th>Tipo habitual</th><th>Asignación actual</th><th>App móvil</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className={c.activo ? '' : 'opacity-60'}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-night text-white flex items-center justify-center text-xs font-semibold" aria-hidden="true">{c.iniciales}</span>
                        <span className="font-medium">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="text-ink-soft font-mono text-xs">{c.licencia || '—'}</td>
                    <td className="capitalize text-ink-soft">{c.tipo}</td>
                    <td>
                      {asignaciones[c.id]?.length
                        ? <div className="flex flex-wrap gap-1.5">{asignaciones[c.id]!.map((a) => <span key={a.bus + a.rol} className="chip-mute">Bus {a.bus} · {a.rol}</span>)}</div>
                        : <span className="text-ink-mute">Sin vehículo</span>}
                    </td>
                    <td>
                      {(() => {
                        const cuenta = cuentaDe(c.id)
                        if (!c.activo) return <span className="text-ink-mute">—</span>
                        if (!cuenta) return <button className="btn-secondary btn-sm" onClick={() => setAcceso({ conductor: c, cuenta: null })}><Smartphone size={14} aria-hidden="true" />Dar acceso</button>
                        return (
                          <div className="flex items-center gap-1.5">
                            <span className={cuenta.activo ? 'chip-ok' : 'chip-mute'} title={cuenta.debe_cambiar_password ? 'Aún no cambió la contraseña temporal' : undefined}>
                              <Smartphone size={12} aria-hidden="true" />@{cuenta.usuario}{cuenta.debe_cambiar_password ? ' · pendiente' : ''}
                            </span>
                            <button className="btn-icon" title="Restablecer contraseña" aria-label={`Restablecer la contraseña de ${c.nombre}`} onClick={() => setAcceso({ conductor: c, cuenta })}><KeyRound size={15} /></button>
                            <button className="btn-icon" title={cuenta.activo ? 'Desactivar acceso' : 'Reactivar acceso'} aria-label={`${cuenta.activo ? 'Desactivar' : 'Reactivar'} el acceso de ${c.nombre}`}
                              onClick={() => alternarAcceso.mutate({ id: cuenta.id, activo: cuenta.activo ? 0 : 1 })}>{cuenta.activo ? <UserX size={15} /> : <UserCheck size={15} />}</button>
                          </div>
                        )
                      })()}
                    </td>
                    <td>{c.activo ? <span className="chip-ok">Activo</span> : <span className="chip-mute">Inactivo</span>}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <button className="btn-icon" onClick={() => setModal(c)} title="Editar" aria-label={`Editar a ${c.nombre}`}><Pencil size={15} /></button>
                        {c.activo ? (
                          <button className="btn-icon hover:!text-bad hover:!bg-bad-soft" onClick={() => setADesactivar(c)} title="Desactivar" aria-label={`Desactivar a ${c.nombre}`}><UserX size={16} /></button>
                        ) : (
                          <button className="btn-icon hover:!text-ok" onClick={() => reactivar.mutate(c.id)} title="Reactivar" aria-label={`Reactivar a ${c.nombre}`}><UserCheck size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal && (
        <Modal title={modal === 'nuevo' ? 'Nuevo conductor' : `Editar a ${modal.nombre}`} onClose={() => setModal(null)} size="md">
          <ConductorForm conductor={modal === 'nuevo' ? null : modal} onClose={() => setModal(null)} />
        </Modal>
      )}

      {acceso && (
        <Modal title={acceso.cuenta ? 'Restablecer contraseña' : 'Acceso a la app móvil'} onClose={() => setAcceso(null)} size="md">
          <AccesoApp conductor={acceso.conductor} cuenta={acceso.cuenta} onClose={() => setAcceso(null)} />
        </Modal>
      )}

      {aDesactivar && (
        <ConfirmDialog
          title="Desactivar conductor"
          message={`${aDesactivar.nombre} dejará de aparecer para nuevos formularios y se liberará de sus vehículos. Sus formularios anteriores se conservan.`}
          confirmLabel="Desactivar"
          busy={desactivar.isPending}
          onConfirm={() => desactivar.mutate(aDesactivar.id)}
          onCancel={() => setADesactivar(null)}
        />
      )}
    </>
  )
}
