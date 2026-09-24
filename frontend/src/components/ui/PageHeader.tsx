import { useEffect, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import TextoProtegido from './TextoProtegido'

interface Props {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: LucideIcon
}

export default function PageHeader({ title, subtitle, actions, icon: Icon }: Props) {
  useEffect(() => { document.title = `${title} · Viáticos VH` }, [title])

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-7">
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-night text-white items-center justify-center shrink-0">
            <Icon size={20} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <TextoProtegido as="h1" className="text-[28px] sm:text-[32px] leading-[1.1] font-semibold text-ink">{title}</TextoProtegido>
          {subtitle && <TextoProtegido as="p" className="text-sm text-ink-mute mt-2">{subtitle}</TextoProtegido>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
