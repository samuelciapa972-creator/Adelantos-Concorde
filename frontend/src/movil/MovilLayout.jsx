import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, KeyRound, Download, EllipsisVertical, X, Share } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/LogoConcordeBlanco.svg'

// Android/Chrome ofrece instalar la app con este evento; iPhone no (hay que usar «Compartir»).
let promptInstalacion = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalacion = e })
}
const esiOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const yaInstalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone

export default function MovilLayout({ titulo, atras, children, onCambiarPassword }) {
  const { usuario, salir } = useAuth()
  const [menu, setMenu] = useState(false)
  const [ayudaIos, setAyudaIos] = useState(false)

  useEffect(() => { if (titulo) document.title = `${titulo} · Viáticos VH` }, [titulo])

  async function instalar() {
    setMenu(false)
    if (promptInstalacion) {
      promptInstalacion.prompt()
      await promptInstalacion.userChoice.catch(() => {})
      promptInstalacion = null
    } else if (esiOS()) setAyudaIos(true)
  }
  const puedeInstalar = !yaInstalada() && (promptInstalacion || esiOS())

  return (
    <div className="min-h-dvh flex flex-col bg-surface">
      <header className="sticky top-0 z-30 bg-night text-white pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          {atras ? (
            <Link to={atras} className="btn-icon !w-10 !h-10 -ml-2 text-white hover:!bg-night-raised hover:!text-white" aria-label="Volver">
              <span aria-hidden="true" className="text-2xl leading-none">‹</span>
            </Link>
          ) : (
            <img src={logo} alt="Concorde" className="h-8 w-auto" />
          )}
          <h1 className="flex-1 min-w-0 truncate font-display text-lg font-semibold">{titulo}</h1>
          <button onClick={() => setMenu(true)} className="btn-icon !w-10 !h-10 -mr-2 text-white hover:!bg-night-raised hover:!text-white" aria-label="Menú">
            <EllipsisVertical size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-xl mx-auto px-4 pt-5 pb-32">{children}</main>

      {menu && (
        <div className="fixed inset-0 z-50 flex items-end animate-fade-in" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenu(false) }}>
          <div className="absolute inset-0 bg-night/60" onClick={() => setMenu(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Menú" className="relative w-full bg-surface-raised rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{usuario?.nombre}</p>
                <p className="text-xs text-ink-mute">@{usuario?.usuario}</p>
              </div>
              <button className="btn-icon" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X size={18} /></button>
            </div>
            <div className="space-y-1">
              {puedeInstalar && (
                <button onClick={instalar} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left hover:bg-surface-sunken"><Download size={20} className="text-ink-mute" />Instalar la app en el celular</button>
              )}
              <button onClick={() => { setMenu(false); onCambiarPassword() }} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left hover:bg-surface-sunken"><KeyRound size={20} className="text-ink-mute" />Cambiar contraseña</button>
              <button onClick={salir} className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left text-bad hover:bg-bad-soft"><LogOut size={20} />Cerrar sesión</button>
            </div>
          </div>
        </div>
      )}

      {ayudaIos && (
        <div className="fixed inset-0 z-50 flex items-end" onMouseDown={(e) => { if (e.target === e.currentTarget) setAyudaIos(false) }}>
          <div className="absolute inset-0 bg-night/60" aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Instalar en iPhone" className="relative w-full bg-surface-raised rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <h2 className="text-xl font-semibold mb-3">Instalar en tu iPhone</h2>
            <ol className="space-y-2 text-sm text-ink-soft list-decimal pl-5">
              <li>Abre esta página en <strong>Safari</strong>.</li>
              <li>Toca el botón <Share size={14} className="inline -mt-0.5" aria-hidden="true" /> <strong>Compartir</strong>.</li>
              <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
            </ol>
            <button className="btn-primary btn-lg w-full mt-5" onClick={() => setAyudaIos(false)}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  )
}
