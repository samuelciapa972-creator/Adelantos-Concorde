import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import TextoProtegido from './TextoProtegido'

type Tono = 'neutral' | 'ok' | 'warn' | 'bad'

const TONOS: Record<Tono, string> = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
}

interface Props {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: Tono
  icon?: LucideIcon
}

export default function StatCard({ label, value, hint, tone = 'neutral', icon: Icon }: Props) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <TextoProtegido as="p" className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</TextoProtegido>
        {Icon && <Icon size={16} className="text-ink-mute" aria-hidden="true" />}
      </div>
      <TextoProtegido as="p" className={`mt-2 font-display font-semibold text-[30px] leading-none ${TONOS[tone]}`}>{value}</TextoProtegido>
      {hint && <TextoProtegido as="p" className="text-xs text-ink-mute mt-2">{hint}</TextoProtegido>}
    </div>
  )
}
