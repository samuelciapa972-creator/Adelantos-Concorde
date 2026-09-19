import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { cambiarPassword } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'

/** Pantalla completa (obligatoria con la contraseña temporal) o formulario en hoja inferior. */
export default function CambiarPassword({ obligatorio = false, onListo, onCancelar }) {
  const { passwordCambiada, salir } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' })
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const distinta = f.repetir && f.nueva !== f.repetir

  const cambiar = useMutation({
    mutationFn: () => cambiarPassword({ actual: f.actual, nueva: f.nueva }),
    meta: { inline: true },
    onSuccess: () => { passwordCambiada(); toast.ok('Contraseña actualizada'); onListo?.() },
  })

  const formulario = (
    <form onSubmit={(e) => { e.preventDefault(); if (!distinta) cambiar.mutate() }} className="space-y-4">
      <div>
        <label htmlFor="pw-a" className="label">{obligatorio ? 'Contraseña temporal (la que te dieron)' : 'Contraseña actual'}</label>
        <input id="pw-a" type="password" autoComplete="current-password" className="input input-lg" value={f.actual} onChange={set('actual')} required />
      </div>
      <div>
        <label htmlFor="pw-n" className="label">Nueva contraseña</label>
        <input id="pw-n" type="password" autoComplete="new-password" minLength={10} className="input input-lg" value={f.nueva} onChange={set('nueva')} required />
        <p className="hint">Mínimo 10 caracteres. Que solo la sepas tú.</p>
      </div>
      <div>
        <label htmlFor="pw-r" className="label">Repite la nueva contraseña</label>
        <input id="pw-r" type="password" autoComplete="new-password" className="input input-lg" value={f.repetir} onChange={set('repetir')} required />
        {distinta && <p className="field-error">Las contraseñas no coinciden.</p>}
      </div>
      {cambiar.isError && <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg px-3 py-2">{cambiar.error.message}</p>}
      <button type="submit" className="btn-primary btn-lg w-full" disabled={cambiar.isPending || Boolean(distinta)}>{cambiar.isPending ? 'Guardando…' : 'Guardar contraseña'}</button>
      {onCancelar && <button type="button" className="btn-ghost btn-lg w-full" onClick={onCancelar}>Cancelar</button>}
    </form>
  )

  if (!obligatorio) {
    return (
      <div className="fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-night/60" onClick={onCancelar} aria-hidden="true" />
        <div role="dialog" aria-modal="true" aria-label="Cambiar contraseña" className="relative w-full max-h-[92dvh] overflow-y-auto bg-surface-raised rounded-t-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <h2 className="text-xl font-semibold mb-4">Cambiar contraseña</h2>
          {formulario}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-surface flex flex-col justify-center px-5 py-8 pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="w-full max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-xl bg-night text-white flex items-center justify-center mb-5"><KeyRound size={22} aria-hidden="true" /></div>
        <h1 className="text-[28px] font-semibold text-ink leading-tight">Crea tu contraseña</h1>
        <p className="text-sm text-ink-soft mt-2 mb-6">Es tu primer ingreso. Cambia la contraseña temporal por una propia para continuar.</p>
        {formulario}
        <button onClick={salir} className="mt-4 w-full text-sm text-ink-mute underline underline-offset-2">Salir</button>
      </div>
    </div>
  )
}
