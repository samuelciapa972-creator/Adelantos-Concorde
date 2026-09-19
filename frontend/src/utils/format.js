const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

/** Moneda colombiana sin decimales. Ej: 54900 → "$ 54.900" */
export function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return COP.format(Math.round(Number(n))).replace(/\s/g, ' ')
}

/** Versión compacta para ejes de gráficos. Ej: 1250000 → "1,25 M" */
export function fmtCorto(n) {
  const v = Number(n) || 0
  const abs = Math.abs(v)
  if (abs >= 1e6) return `${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 2 })} M`
  if (abs >= 1e3) return `${(v / 1e3).toLocaleString('es-CO', { maximumFractionDigits: 0 })} mil`
  return String(v)
}

export const ESTADOS = {
  legalizado:    { label: 'Legalizado',    tone: 'ok' },
  pendiente:     { label: 'Pendiente',     tone: 'warn' },
  sin_legalizar: { label: 'Sin legalizar', tone: 'bad' },
}

export function badgeLabel(estado) {
  return (ESTADOS[estado] ?? ESTADOS.sin_legalizar).label
}

export function iniciales(nombre = '') {
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}
