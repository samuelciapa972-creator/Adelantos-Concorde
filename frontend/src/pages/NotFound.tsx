import { Link } from 'react-router-dom'
import { useEffect } from 'react'

export default function NotFound() {
  useEffect(() => { document.title = 'No encontrada · Viáticos VH' }, [])
  return (
    <div className="panel max-w-lg mx-auto mt-16 p-10 text-center">
      <p className="font-display font-semibold text-8xl text-ink-mute/60 leading-none">404</p>
      <h1 className="text-2xl font-semibold text-ink mt-4">Esta página no existe</h1>
      <p className="text-sm text-ink-mute mt-2">Revisa la dirección o vuelve al panel general.</p>
      <Link to="/" className="btn-primary mt-6">Ir al panel general</Link>
    </div>
  )
}
