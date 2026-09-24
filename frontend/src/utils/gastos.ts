import { Fuel, TrafficCone, BedDouble, Utensils, ParkingSquare, Wrench, Hammer, Receipt, type LucideIcon } from 'lucide-react'
import type { TipoGasto } from '../types'

export const TIPOS_GASTO: { value: TipoGasto; label: string; icon: LucideIcon }[] = [
  { value: 'combustible', label: 'Combustible', icon: Fuel },
  { value: 'peaje', label: 'Peaje', icon: TrafficCone },
  { value: 'hotel', label: 'Hotel', icon: BedDouble },
  { value: 'alimentacion', label: 'Alimentación', icon: Utensils },
  { value: 'parqueadero', label: 'Parqueadero', icon: ParkingSquare },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { value: 'reparacion', label: 'Reparación', icon: Hammer },
  { value: 'otro', label: 'Otro', icon: Receipt },
]

export const ETIQUETA_TIPO = Object.fromEntries(TIPOS_GASTO.map((t) => [t.value, t.label])) as Record<TipoGasto, string>

export const hoyISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
