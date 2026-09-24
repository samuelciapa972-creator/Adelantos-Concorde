import { CheckCircle2, Clock3, CircleAlert, type LucideIcon } from 'lucide-react'
import type { ResumenVehiculo } from '../../types'

// Colores de estado (reservados; no se usan como color de serie)
const ESTADOS: { key: 'legalizados' | 'con_pendiente' | 'sin_legalizar'; label: string; fill: string; Icon: LucideIcon }[] = [
  { key: 'legalizados',   label: 'Legalizados',   fill: '#0F8A5F', Icon: CheckCircle2 },
  { key: 'con_pendiente', label: 'Pendientes',    fill: '#C77D0A', Icon: Clock3 },
  { key: 'sin_legalizar', label: 'Sin legalizar', fill: '#D13B30', Icon: CircleAlert },
]

/** Una barra apilada al 100 % por vehículo, con el conteo dentro de cada tramo. */
export default function StatusBars({ filas }: { filas: ResumenVehiculo[] }) {
  return (
    <div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-sm text-ink-soft list-none p-0" aria-label="Leyenda">
        {ESTADOS.map(({ key, label, fill, Icon }) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-[3px]" style={{ background: fill }} aria-hidden="true" />
            <Icon size={13} aria-hidden="true" className="text-ink-mute" />
            {label}
          </li>
        ))}
      </ul>

      <div className="space-y-3.5">
        {filas.map((f) => {
          const total = ESTADOS.reduce((s, e) => s + (f[e.key] ?? 0), 0)
          return (
            <div key={f.vehiculo_id} className="grid grid-cols-[3.75rem_1fr_auto] items-center gap-3">
              <span className="font-display font-semibold text-ink text-lg leading-none">{f.vehiculo}</span>
              {total === 0 ? (
                <div className="h-7 rounded-md bg-surface-sunken text-xs text-ink-mute flex items-center px-3">Sin formularios</div>
              ) : (
                <div
                  className="flex h-7 gap-[2px] rounded-md overflow-hidden"
                  role="img"
                  aria-label={`Bus ${f.vehiculo}: ${ESTADOS.map((e) => `${f[e.key] ?? 0} ${e.label.toLowerCase()}`).join(', ')}`}
                >
                  {ESTADOS.map((e) => {
                    const n = f[e.key] ?? 0
                    if (!n) return null
                    return (
                      <div
                        key={e.key}
                        title={`${e.label}: ${n}`}
                        className="flex items-center justify-center text-[11px] font-semibold text-white min-w-[1.25rem]"
                        style={{ width: `${(n / total) * 100}%`, background: e.fill }}
                      >
                        {n}
                      </div>
                    )
                  })}
                </div>
              )}
              <span className="text-xs text-ink-mute tabular-nums w-8 text-right">{total}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
