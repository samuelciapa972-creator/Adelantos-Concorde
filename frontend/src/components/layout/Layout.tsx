import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard, FileText, BusFront, Users, TriangleAlert, CalendarDays,
  Plus, LogOut, Menu, X, Lock, LockOpen, KeyRound,
} from 'lucide-react'

import { useMes } from '../../context/MesContext'
import { useAuth } from '../../context/AuthContext'
import { getVehiculos, getResumenMes, crearMes, cerrarMes, reabrirMes, cambiarPassword } from '../../api'
import { useToast } from '../ui/Toast'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import logo from '../../assets/LogoConcordeBlanco.svg'

const NAV = [
  { to: '/', label: 'Panel general', icon: LayoutDashboard },
  { to: '/formularios', label: 'Formularios', icon: FileText },
  { to: '/vehiculos', label: 'Vehículos', icon: BusFront },
  { to: '/conductores', label: 'Conductores', icon: Users },
  { to: '/alertas', label: 'Alertas', icon: TriangleAlert, alerta: true },
]

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const selectOscuro =
  'w-full bg-night-raised border border-night-line rounded-lg px-3 py-2 text-sm text-white ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-100/60'

type Dialogo = 'mes' | 'password' | 'cerrar' | 'reabrir'
type AccionMes = 'cerrar' | 'reabrir'

function ModalNuevoMes({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const { setMesId } = useMes()
  const hoy = new Date()
  const [nombre, setNombre] = useState(MESES_NOMBRES[hoy.getMonth()])
  const [anio, setAnio] = useState(String(hoy.getFullYear()))

  const crear = useMutation({
    mutationFn: crearMes,
    meta: { inline: true },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['meses'] })
      setMesId(data.id)
      toast.ok(`Mes ${nombre} ${anio} creado`)
      onClose()
    },
  })

  return (
    <Modal title="Nuevo mes" onClose={onClose} size="sm">
      <form
        onSubmit={(e) => { e.preventDefault(); crear.mutate({ nombre, anio: Number(anio) }) }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="nm-mes" className="label">Mes</label>
          <select id="nm-mes" className="select" value={nombre} onChange={(e) => setNombre(e.target.value)}>
            {MESES_NOMBRES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="nm-anio" className="label">Año</label>
          <input id="nm-anio" type="number" min={2020} max={2100} className="input" value={anio} onChange={(e) => setAnio(e.target.value)} required />
        </div>
        {crear.isError && <p role="alert" className="field-error">{crear.error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={crear.isPending}>{crear.isPending ? 'Creando…' : 'Crear mes'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ModalPassword({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' })
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const distinta = Boolean(f.repetir) && f.nueva !== f.repetir

  const cambiar = useMutation({
    mutationFn: () => cambiarPassword({ actual: f.actual, nueva: f.nueva }),
    meta: { inline: true },
    onSuccess: () => { toast.ok('Contraseña actualizada. Las demás sesiones se cerraron.'); onClose() },
  })

  return (
    <Modal title="Cambiar contraseña" onClose={onClose} size="sm">
      <form
        onSubmit={(e) => { e.preventDefault(); if (!distinta) cambiar.mutate() }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="pw-actual" className="label">Contraseña actual</label>
          <input id="pw-actual" type="password" autoComplete="current-password" className="input" value={f.actual} onChange={set('actual')} required />
        </div>
        <div>
          <label htmlFor="pw-nueva" className="label">Nueva contraseña</label>
          <input id="pw-nueva" type="password" autoComplete="new-password" minLength={10} className="input" value={f.nueva} onChange={set('nueva')} required />
          <p className="hint">Mínimo 10 caracteres.</p>
        </div>
        <div>
          <label htmlFor="pw-rep" className="label">Repite la nueva contraseña</label>
          <input id="pw-rep" type="password" autoComplete="new-password" className="input" value={f.repetir} onChange={set('repetir')} required />
          {distinta && <p className="field-error">Las contraseñas no coinciden.</p>}
        </div>
        {cambiar.isError && <p role="alert" className="field-error">{cambiar.error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={cambiar.isPending || distinta}>
            {cambiar.isPending ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { mesId, setMesId, vehiculoId, setVehiculoId, mes, meses, cerrado } = useMes()
  const { usuario, salir } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)

  const { data: vehiculos = [] } = useQuery({ queryKey: ['vehiculos'], queryFn: getVehiculos })

  // Misma consulta que el Panel: la insignia de Alertas no cuesta una petición extra
  const { data: resumen } = useQuery({
    queryKey: ['resumen', mesId, vehiculoId],
    queryFn: () => getResumenMes(mesId!, vehiculoId), // enabled garantiza que hay mes
    enabled: Boolean(mesId),
  })
  const alertas = (resumen?.resumen ?? []).reduce((s, r) => s + (r.sin_legalizar ?? 0) + (r.con_pendiente ?? 0), 0)

  const estadoMes = useMutation({
    mutationFn: (accion: AccionMes) => {
      if (!mesId) throw new Error('No hay un mes seleccionado')
      return accion === 'cerrar' ? cerrarMes(mesId) : reabrirMes(mesId)
    },
    onSuccess: (_, accion) => {
      qc.invalidateQueries({ queryKey: ['meses'] })
      toast.ok(accion === 'cerrar' ? 'Mes cerrado: ya no admite cambios' : 'Mes reabierto')
      setDialogo(null)
    },
  })

  return (
    <div className="flex flex-col h-full bg-night text-white">
      <div className="px-6 pt-7 pb-6 border-b border-night-line">
        <img src={logo} alt="Concorde" className="h-12 w-auto mx-auto" />
        <p className="text-center font-display font-semibold text-xl mt-3">Viáticos VH</p>
      </div>

      <div className="px-4 py-4 space-y-4 border-b border-night-line">
        <div>
          <label htmlFor="sel-vehiculo" className="flex items-center gap-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            <BusFront size={13} aria-hidden="true" /> Vehículo
          </label>
          <select
            id="sel-vehiculo"
            value={vehiculoId ?? ''}
            onChange={(e) => setVehiculoId(e.target.value ? Number(e.target.value) : null)}
            className={selectOscuro}
          >
            <option value="">Todos los vehículos</option>
            {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.numero_interno} — {v.placa ?? 'Sin placa'}</option>)}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="sel-mes" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <CalendarDays size={13} aria-hidden="true" /> Mes activo
            </label>
            <button onClick={() => setDialogo('mes')} className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-night-raised">
              <Plus size={12} aria-hidden="true" /> Nuevo
            </button>
          </div>
          <select
            id="sel-mes"
            value={mesId ?? ''}
            onChange={(e) => setMesId(e.target.value ? Number(e.target.value) : null)}
            className={selectOscuro}
          >
            <option value="">Seleccionar mes</option>
            {meses.map((m) => <option key={m.id} value={m.id}>{m.nombre} {m.anio}{m.cerrado ? ' · cerrado' : ''}</option>)}
          </select>

          {mes && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className={`chip ${cerrado ? 'bg-night-raised text-zinc-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                {cerrado ? <Lock size={12} aria-hidden="true" /> : <LockOpen size={12} aria-hidden="true" />}
                {cerrado ? 'Cerrado' : 'Abierto'}
              </span>
              <button
                onClick={() => setDialogo(cerrado ? 'reabrir' : 'cerrar')}
                className="text-xs text-zinc-300 hover:text-white underline-offset-2 hover:underline"
              >
                {cerrado ? 'Reabrir mes' : 'Cerrar mes'}
              </button>
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Principal">
        <ul className="space-y-1 list-none p-0 m-0">
          {NAV.map(({ to, label, icon: Icon, alerta }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-white text-ink font-semibold' : 'text-zinc-300 hover:bg-night-raised hover:text-white'
                  }`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                {alerta && alertas > 0 && (
                  <span className="min-w-[1.4rem] h-[1.4rem] px-1.5 rounded-full bg-bad text-white text-[11px] font-semibold flex items-center justify-center" aria-label={`${alertas} alertas`}>
                    {alertas}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-night-line">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-night-raised border border-night-line flex items-center justify-center text-xs font-semibold" aria-hidden="true">
            {(usuario?.nombre ?? '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{usuario?.nombre}</p>
            <p className="text-xs text-zinc-400 truncate">@{usuario?.usuario}</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setDialogo('password')} className="flex items-center justify-center gap-1.5 text-xs text-zinc-300 hover:text-white py-2 rounded-lg bg-night-raised hover:bg-night-line transition-colors">
            <KeyRound size={13} aria-hidden="true" /> Contraseña
          </button>
          <button onClick={salir} className="flex items-center justify-center gap-1.5 text-xs text-zinc-300 hover:text-white py-2 rounded-lg bg-night-raised hover:bg-night-line transition-colors">
            <LogOut size={13} aria-hidden="true" /> Salir
          </button>
        </div>
      </div>

      {dialogo === 'mes' && <ModalNuevoMes onClose={() => setDialogo(null)} />}
      {dialogo === 'password' && <ModalPassword onClose={() => setDialogo(null)} />}
      {(dialogo === 'cerrar' || dialogo === 'reabrir') && (
        <ConfirmDialog
          title={dialogo === 'cerrar' ? `Cerrar ${mes?.nombre} ${mes?.anio}` : `Reabrir ${mes?.nombre} ${mes?.anio}`}
          message={dialogo === 'cerrar'
            ? 'Un mes cerrado no admite crear, editar ni eliminar formularios y gastos. Podrás reabrirlo si hace falta.'
            : 'El mes volverá a admitir cambios en formularios y gastos.'}
          confirmLabel={dialogo === 'cerrar' ? 'Cerrar mes' : 'Reabrir mes'}
          tone={dialogo === 'cerrar' ? 'danger' : 'primary'}
          busy={estadoMes.isPending}
          onConfirm={() => estadoMes.mutate(dialogo)}
          onCancel={() => setDialogo(null)}
        />
      )}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => { setAbierto(false) }, [pathname])
  useEffect(() => {
    if (!abierto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [abierto])

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:bg-white focus:text-ink focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-pop">
        Saltar al contenido
      </a>

      {/* Escritorio */}
      <aside className="hidden lg:block w-72 shrink-0"><Sidebar /></aside>

      {/* Móvil: cajón lateral */}
      {abierto && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-night/60 animate-fade-in" onClick={() => setAbierto(false)} aria-hidden="true" />
          <aside className="relative w-72 max-w-[85vw] animate-fade-in"><Sidebar onNavigate={() => setAbierto(false)} /></aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 bg-night text-white px-4 py-3">
          <button onClick={() => setAbierto(!abierto)} className="btn-icon text-white hover:bg-night-raised hover:text-white" aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={abierto}>
            {abierto ? <X size={20} /> : <Menu size={20} />}
          </button>
          <img src={logo} alt="Concorde" className="h-7 w-auto" />
          <span className="font-display font-semibold text-lg">Viáticos VH</span>
        </header>

        <main id="contenido" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
