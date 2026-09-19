import { useId } from 'react'

/** Etiqueta + control enlazados; el control recibe el id por render-prop. */
export default function Field({ label, hint, required, children, className = '' }) {
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
