import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react'
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
      <div className="w-full max-w-sm">
        <h1 className="text-[34px] font-semibold text-ink">Falta crear un usuario</h1>
        <p className="text-sm text-ink-soft mt-3">
          Todavía no hay usuarios registrados y el primero solo puede crearse desde el equipo donde corre el servidor.
          Ejecuta en esa terminal:
        </p>
        <pre className="mt-4 bg-night text-white text-xs rounded-lg p-3 overflow-x-auto">npm run usuario -- admin "Nombre Apellido"</pre>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm" aria-labelledby="setup-titulo">
      <h1 id="setup-titulo" className="text-[34px] font-semibold text-ink">Crear el primer usuario</h1>
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

        <button type="submit" disabled={enviando || Boolean(distinta)} className="btn-primary w-full py-2.5">
          <UserPlus size={16} aria-hidden="true" />
          {enviando ? 'Creando…' : 'Crear usuario e ingresar'}
        </button>
      </div>
    </form>
  )
}

export default function Login() {
  const { entrar } = useAuth()
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [ver, setVer] = useState(false)
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

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.05fr_1fr] bg-surface">
      {/* Panel de marca */}
      <div className="hidden lg:flex flex-col justify-between bg-night text-white p-12 relative overflow-hidden">
        <img src={logo} alt="Concorde" className="h-14 w-auto self-start" />
        <div className="relative z-10">
          <p className="font-display font-semibold text-[52px] leading-[1.05] text-balance">
            Anticipos y viáticos<br />bajo control.
          </p>
          <p className="mt-6 text-zinc-400 max-w-sm">
            Registra los anticipos por bus, legaliza los gastos con su soporte y cierra cada mes con reportes listos para contabilidad.
          </p>
        </div>
        <p className="text-xs text-zinc-500">Acceso restringido a personal autorizado.</p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center p-6">
        {sinUsuarios ? <PrimerUsuario puedeConfigurar={estado.puedeConfigurar} /> : (
        <form onSubmit={onSubmit} className="w-full max-w-sm" aria-labelledby="login-titulo">
          <img src={logo} alt="" className="h-10 w-auto mb-8 lg:hidden invert" />
          <h1 id="login-titulo" className="text-[34px] font-semibold text-ink">Ingresar</h1>
          <p className="text-sm text-ink-mute mt-2 mb-8">Usa tu usuario y contraseña de Viáticos VH.</p>

          <div className="space-y-4">
            <div>
              <label htmlFor="usuario" className="label">Usuario</label>
              <input id="usuario" className="input" autoComplete="username" autoFocus autoCapitalize="none" spellCheck={false}
                value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            </div>

            <div>
              <label htmlFor="password" className="label">Contraseña</label>
              <div className="relative">
                <input id="password" type={ver ? 'text' : 'password'} className="input pr-11" autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setVer(!ver)} className="btn-icon absolute right-1 top-1/2 -translate-y-1/2"
                  aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={ver}>
                  {ver ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={enviando} className="btn-primary w-full py-2.5">
              <LogIn size={16} aria-hidden="true" />
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
