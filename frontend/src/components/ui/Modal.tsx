import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Tamano = 'sm' | 'md' | 'lg' | 'xl'

const ANCHOS: Record<Tamano, string> = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface Props {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  size?: Tamano
}

export default function Modal({ title, onClose, children, size = 'md' }: Props) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    if (!ref.current) return
    const el: HTMLDivElement = ref.current
    // Foco inicial en el primer campo (o en el diálogo)
    ;(el.querySelector<HTMLElement>('input,select,textarea') ?? el).focus()
    document.body.style.overflow = 'hidden'

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab') return
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)]
      const primero = items[0], ultimo = items[items.length - 1]
      if (!primero || !ultimo) return
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previo?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-night/60 backdrop-blur-[2px] sm:p-4 animate-fade-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-surface-raised w-full ${ANCHOS[size] ?? ANCHOS.md} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-pop animate-fade-up outline-none`}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-line">
          <h2 id={titleId} className="text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="btn-icon -mr-2" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
