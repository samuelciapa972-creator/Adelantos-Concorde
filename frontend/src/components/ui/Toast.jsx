import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONOS = { ok: CheckCircle2, error: CircleAlert, info: Info }
const TONOS = {
  ok:    'border-ok/30 text-ok',
  error: 'border-bad/30 text-bad',
  info:  'border-brand-500/30 text-brand-600',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const id = useRef(0)

  const quitar = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), [])

  const mostrar = useCallback((mensaje, tipo = 'info') => {
    const tid = ++id.current
    setToasts((t) => [...t.slice(-3), { id: tid, mensaje, tipo }])
    setTimeout(() => quitar(tid), tipo === 'error' ? 7000 : 3500)
  }, [quitar])

  const api = useMemo(() => ({
    ok:    (m) => mostrar(m, 'ok'),
    error: (m) => mostrar(m, 'error'),
    info:  (m) => mostrar(m, 'info'),
  }), [mostrar])

  // Errores globales de mutaciones (ver main.jsx)
  useEffect(() => {
    const onError = (e) => mostrar(e.detail || 'Ocurrió un error', 'error')
    window.addEventListener('app:error', onError)
    return () => window.removeEventListener('app:error', onError)
  }, [mostrar])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed z-[70] top-[calc(env(safe-area-inset-top)+4rem)] inset-x-4 sm:top-auto sm:bottom-4 sm:right-4 sm:left-auto sm:inset-x-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
        role="region"
        aria-label="Notificaciones"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const Icon = ICONOS[t.tipo]
          return (
            <div
              key={t.id}
              role={t.tipo === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 bg-surface-raised border rounded-xl shadow-pop px-4 py-3 animate-fade-up ${TONOS[t.tipo]}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-sm text-ink flex-1">{t.mensaje}</p>
              <button onClick={() => quitar(t.id)} className="text-ink-mute hover:text-ink" aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
  return ctx
}
