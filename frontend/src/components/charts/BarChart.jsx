import { useMemo, useState } from 'react'
import { fmt, fmtCorto } from '../../utils/format'

// Serie 1 = índigo de la marca, serie 2 = naranja. Validados (daltonismo y contraste)
// con el validador de paletas de dataviz.
export const SERIES_COLORS = ['#534AB7', '#EB6834']

const W = 640
const H = 280
const M = { top: 16, right: 12, bottom: 34, left: 56 }
const PLOT_W = W - M.left - M.right
const PLOT_H = H - M.top - M.bottom

function escalaNice(max) {
  if (max <= 0) return { top: 1, step: 1 }
  const exp = Math.pow(10, Math.floor(Math.log10(max / 4)))
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * exp).find((s) => max / s <= 5) ?? 10 * exp
  return { top: Math.ceil(max / paso) * paso, step: paso }
}

// Barra con las esquinas superiores redondeadas (4 px) y la base pegada al eje
function barra(x, y, w, h, r = 4) {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`
}

/**
 * Barras agrupadas: una serie por barra dentro de cada grupo.
 * data: [{ label, valores: [n, n], detalle?: string }]
 */
export default function BarChart({ data, series, ariaLabel }) {
  const [activo, setActivo] = useState(null)

  const { top, step } = useMemo(
    () => escalaNice(Math.max(0, ...data.flatMap((d) => d.valores))),
    [data],
  )
  const ticks = useMemo(() => {
    const t = []
    for (let v = 0; v <= top + 1e-9; v += step) t.push(v)
    return t
  }, [top, step])

  const y = (v) => M.top + PLOT_H - (v / top) * PLOT_H
  const grupoW = PLOT_W / Math.max(data.length, 1)
  const barW = Math.min(44, (grupoW - 24) / series.length - 2)
  const etiquetar = data.length <= 6

  const tip = activo != null ? data[activo] : null

  return (
    <figure className="m-0">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-sm text-ink-soft list-none p-0" aria-label="Leyenda">
        {series.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[3px]" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
            {s}
          </li>
        ))}
      </ul>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="group" aria-label={ariaLabel}>
          {/* Cuadrícula tenue + eje Y */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#E4E3EB" strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7B7A8A" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtCorto(t)}
              </text>
            </g>
          ))}

          {data.map((d, gi) => {
            const cx = M.left + grupoW * gi + grupoW / 2
            const x0 = cx - (series.length * barW + (series.length - 1) * 2) / 2
            // Una sola etiqueta por grupo (la barra mayor): así nunca se pisan las cifras vecinas
            const mayor = Math.max(...d.valores)
            const resumen = `${d.label}: ${series.map((s, i) => `${s} ${fmt(d.valores[i])}`).join(', ')}`
            return (
              <g
                key={d.label}
                tabIndex={0}
                role="img"
                aria-label={resumen}
                onMouseEnter={() => setActivo(gi)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(gi)}
                onBlur={() => setActivo(null)}
                style={{ outline: 'none' }}
              >
                {/* Zona de impacto más grande que las barras */}
                <rect x={M.left + grupoW * gi} y={M.top} width={grupoW} height={PLOT_H} fill={activo === gi ? '#534AB7' : 'transparent'} fillOpacity={0.06} rx="6" />
                {d.valores.map((v, si) => {
                  const h = (v / top) * PLOT_H
                  const x = x0 + si * (barW + 2)
                  return (
                    <g key={si}>
                      {h > 0 && <path d={barra(x, y(v), barW, h)} fill={SERIES_COLORS[si]} />}
                      {etiquetar && v > 0 && v === mayor && (
                        <text x={x + barW / 2} y={y(v) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#4B4A5A" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {fmtCorto(v)}
                        </text>
                      )}
                    </g>
                  )
                })}
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#15141F">{d.label}</text>
              </g>
            )
          })}
        </svg>

        {tip && (
          <div
            className="absolute z-10 pointer-events-none bg-night text-white rounded-lg shadow-pop px-3 py-2 text-xs -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${((M.left + grupoW * activo + grupoW / 2) / W) * 100}%`, top: 4 }}
            role="tooltip"
          >
            <p className="font-semibold mb-1">{tip.label}{tip.detalle ? ` · ${tip.detalle}` : ''}</p>
            {series.map((s, i) => (
              <p key={s} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-[2px]" style={{ background: SERIES_COLORS[i] }} aria-hidden="true" />
                <span className="text-zinc-300">{s}</span>
                <span className="ml-auto pl-4 tabular-nums font-medium">{fmt(tip.valores[i])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
