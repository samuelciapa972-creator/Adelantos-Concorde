import { useId, type ReactNode } from 'react'

/** Etiqueta + control enlazados; el control recibe el id por render-prop. */
interface Props {
  label: string
  hint?: ReactNode
  required?: boolean
  /** Recibe el id que debe llevar el control para quedar enlazado a la etiqueta. */
  children: (id: string) => ReactNode
  className?: string
}

export default function Field({ label, hint, required, children, className = '' }: Props) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}{required && <span className="text-bad" aria-hidden="true"> *</span>}
      </label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}
