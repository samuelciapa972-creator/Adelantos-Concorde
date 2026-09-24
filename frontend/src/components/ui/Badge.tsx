import { CheckCircle2, Clock3, CircleAlert } from 'lucide-react'
import { ESTADOS, type Tono } from '../../utils/format'
import type { EstadoFormulario } from '../../types'
import TextoProtegido from './TextoProtegido'

const ICONO: Record<Tono, typeof CheckCircle2> = { ok: CheckCircle2, warn: Clock3, bad: CircleAlert }

export default function Badge({ estado }: { estado: EstadoFormulario }) {
  const { label, tone } = ESTADOS[estado] ?? ESTADOS.sin_legalizar
  const Icon = ICONO[tone]
  return (
    <span className={`chip-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      <TextoProtegido>{label}</TextoProtegido>
    </span>
  )
}
