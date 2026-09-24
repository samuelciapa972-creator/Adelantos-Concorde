import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Eye, EyeOff, LogIn, UserPlus, User, Lock, ShieldCheck, Wallet, Receipt,
  FileSpreadsheet, LoaderCircle, TriangleAlert, CircleAlert,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getEstadoAuth } from '../api'
import logo from '../assets/LogoConcordeBlanco.svg'

function PrimerUsuario({ puedeConfigurar }) {
  const { configurar } = useAuth()
  const [f, setF] = useState({ usuario: 'admin', nombre: '', password: '', repetir: '' })
  const [ver, setVer] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const distinta = f.repetir && f.password !== f.repetir

  async function onSubmit(e) {
    e.preventDefault()
    if (distinta) return
    setError('')
    setEnviando(true)
    try {
      await configurar({ usuario: f.usuario.trim(), nombre: f.nombre.trim(), password: f.password })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  if (!puedeConfigurar) {
    return (
      <div>
        <h1 className="text-[30px] leading-tight font-semibold text-ink">Falta crear un usuario</h1>
        <p className="text-sm text-ink-soft mt-3">
          Todavía no hay usuarios registrados y el primero solo puede crearse desde el equipo donde corre el servidor.
          Ejecuta en esa terminal:
        </p>
        <pre className="mt-4 bg-night text-white text-xs rounded-lg p-3 overflow-x-auto">npm run usuario -- admin "Nombre Apellido"</pre>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} aria-labelledby="setup-titulo">
      <h1 id="setup-titulo" className="text-[30px] leading-tight font-semibold text-ink">Crear el primer usuario</h1>
      <p className="text-sm text-ink-mute mt-2 mb-6">
        Aún no hay usuarios. Este será el administrador; podrás cambiar la contraseña luego desde el menú.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="su-nombre" className="label">Nombre completo</label>
          <input id="su-nombre" className="input" autoComplete="name" autoFocus value={f.nombre} onChange={set('nombre')} required minLength={2} maxLength={100} />
        </div>
        <div>
          <label htmlFor="su-usuario" className="label">Usuario para iniciar sesión</label>
          <input id="su-usuario" className="input" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={f.usuario} onChange={set('usuario')} required pattern="[A-Za-z0-9._\-]{3,50}" title="Letras, números, punto, guion y guion bajo (3 a 50)" />
          <p className="hint">Sin espacios. Es lo que escribirás al ingresar.</p>
        </div>
        <div>
          <label htmlFor="su-pass" className="label">Contraseña</label>
          <div className="relative">
            <input id="su-pass" type={ver ? 'text' : 'password'} className="input pr-11" autoComplete="new-password" minLength={10}
              value={f.password} onChange={set('password')} required />
            <button type="button" onClick={() => setVer(!ver)} className="btn-icon absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}>
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="hint">Mínimo 10 caracteres.</p>
        </div>
        <div>
          <label htmlFor="su-rep" className="label">Repite la contraseña</label>
          <input id="su-rep" type={ver ? 'text' : 'password'} className="input" autoComplete="new-password" value={f.repetir} onChange={set('repetir')} required />
          {distinta && <p className="field-error">Las contraseñas no coinciden.</p>}
        </div>

        {error && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={enviando || Boolean(distinta)} className="btn-primary btn-lg w-full shadow-card">
          <UserPlus size={16} aria-hidden="true" />
          {enviando ? 'Creando…' : 'Crear usuario e ingresar'}
        </button>
      </div>
    </form>
  )
}

const FUNCIONES = [
  { icon: Wallet, titulo: 'Anticipos por bus', texto: 'Registra cada anticipo y su conductor en segundos.' },
  { icon: Receipt, titulo: 'Legalización con soporte', texto: 'Cada gasto queda ligado a su factura o recibo.' },
  { icon: FileSpreadsheet, titulo: 'Cierre mensual', texto: 'Reportes listos para contabilidad, sin hojas sueltas.' },
]

// Trama de libro contable: renglones horizontales y un margen vertical, muy tenues
const TRAMA = {
  backgroundImage:
    'linear-gradient(rgb(255 255 255 / .045) 1px, transparent 1px),' +
    'linear-gradient(90deg, rgb(255 255 255 / .045) 1px, transparent 1px)',
  backgroundSize: '100% 32px, 32px 100%',
  maskImage: 'radial-gradient(ellipse at 30% 40%, #000 20%, transparent 75%)',
}

function PanelMarca() {
  return (
    <aside className="hidden lg:flex flex-col justify-between bg-night text-white p-12 xl:p-16 relative overflow-hidden">
      <div aria-hidden="true" className="absolute inset-0" style={TRAMA} />
      <div aria-hidden="true" className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full bg-brand-500/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 right-[-120px] w-[420px] h-[420px] rounded-full bg-brand-700/30 blur-3xl" />

      <img src={logo} alt="Concorde" className="relative h-14 w-auto self-start" />

      <div className="relative max-w-lg">
        <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-100/80 mb-5">
          <span className="w-6 h-px bg-brand-100/60" aria-hidden="true" /> Viáticos VH
        </p>
        <h2 className="font-display font-semibold text-[48px] xl:text-[56px] leading-[1.04] text-balance">
          Anticipos y viáticos bajo control.
        </h2>
        <p className="mt-5 text-zinc-400 text-[15px] leading-relaxed max-w-md">
          Registra, legaliza y cierra cada mes con la trazabilidad que exige contabilidad.
        </p>

        <ul className="mt-10 space-y-5">
          {FUNCIONES.map(({ icon: Icon, titulo, texto }) => (
            <li key={titulo} className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center text-brand-100">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-medium text-white">{titulo}</span>
                <span className="block text-sm text-zinc-400 mt-0.5">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative flex items-center gap-2 text-xs text-zinc-500">
        <ShieldCheck size={14} aria-hidden="true" />
        Acceso restringido a personal autorizado · © {new Date().getFullYear()} Concorde
      </p>
    </aside>
  )
}

export default function Login() {
  const { entrar } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
  const [mayus, setMayus] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { document.title = 'Ingresar · Viáticos VH' }, [])

  const { data: estado } = useQuery({ queryKey: ['estado-auth'], queryFn: getEstadoAuth, staleTime: 0, retry: false })
  const sinUsuarios = estado && !estado.configurado

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    try {
      await entrar({ usuario: usuario.trim(), password })
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setEnviando(false)
    }
  }

  const revisarMayus = (e) => setMayus(e.getModifierState?.('CapsLock') ?? false)

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.05fr_1fr] bg-surface">
      <PanelMarca />

      <main className="relative flex flex-col items-center justify-center px-5 py-10 sm:p-10">
        {/* Logo en móvil, sobre una franja oscura de marca */}
        <div className="lg:hidden w-full max-w-md mb-6 rounded-2xl bg-night px-6 py-5 flex items-center justify-between">
          <img src={logo} alt="Concorde" className="h-9 w-auto" />
          <span className="text-xs font-medium text-brand-100/80 uppercase tracking-[0.12em]">Viáticos VH</span>
        </div>

        <div className="w-full max-w-md bg-surface-raised border border-line rounded-2xl shadow-pop p-7 sm:p-10 animate-fade-up">
          {sinUsuarios ? <PrimerUsuario puedeConfigurar={estado.puedeConfigurar} /> : (
          <form onSubmit={onSubmit} aria-labelledby="login-titulo">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-6">
              <LogIn size={22} aria-hidden="true" />
            </div>
            <h1 id="login-titulo" className="text-[30px] leading-tight font-semibold text-ink">Bienvenido de nuevo</h1>
            <p className="text-sm text-ink-mute mt-2 mb-8 text-pretty">Ingresa con tu usuario y contraseña de Viáticos&nbsp;VH.</p>

            <div className="space-y-5">
              <div>
                <label htmlFor="usuario" className="label">Usuario</label>
                <div className="relative">
                  <User size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  <input id="usuario" className="input input-lg pl-11" autoComplete="username" autoFocus autoCapitalize="none" spellCheck={false}
                    placeholder="tu.usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Contraseña</label>
                <div className="relative">
                  <Lock size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none" />
                  <input id="password" type={ver ? 'text' : 'password'} className="input input-lg pl-11 pr-12" autoComplete="current-password"
                    placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={revisarMayus} onKeyDown={revisarMayus} onBlur={() => setMayus(false)}
                    aria-describedby={mayus ? 'aviso-mayus' : undefined} required />
                  <button type="button" onClick={() => setVer(!ver)} className="btn-icon w-9 h-9 absolute right-1.5 top-1/2 -translate-y-1/2"
                    aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}>
                    {ver ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {mayus && (
                  <p id="aviso-mayus" className="mt-1.5 flex items-center gap-1.5 text-xs text-warn">
                    <TriangleAlert size={13} aria-hidden="true" /> Bloq Mayús está activado.
                  </p>
                )}
              </div>

              {error && (
                <p role="alert" className="flex items-start gap-2 text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2.5">
                  <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}

              <button type="submit" disabled={enviando} className="btn-primary btn-lg w-full shadow-card">
                {enviando
                  ? <><LoaderCircle size={18} aria-hidden="true" className="animate-spin" /> Ingresando…</>
                  : <><LogIn size={18} aria-hidden="true" /> Ingresar</>}
              </button>
            </div>

            <p className="mt-8 pt-6 border-t border-line flex items-start gap-2 text-xs text-ink-mute">
              <ShieldCheck size={14} aria-hidden="true" className="shrink-0 mt-px" />
              ¿Olvidaste tu contraseña? Pídele al administrador que la restablezca.
            </p>
          </form>
          )}
        </div>

        <p className="lg:hidden mt-6 text-xs text-ink-mute text-center">
          Acceso restringido a personal autorizado · © {new Date().getFullYear()} Concorde
        </p>
      </main>
    </div>
  )
}
