import { Fuel, TrafficCone, BedDouble, Utensils, ParkingSquare, Wrench, Hammer, Receipt } from 'lucide-react'

export const TIPOS_GASTO = [
  { value: 'combustible', label: 'Combustible', icon: Fuel },
  { value: 'peaje', label: 'Peaje', icon: TrafficCone },
  { value: 'hotel', label: 'Hotel', icon: BedDouble },
  { value: 'alimentacion', label: 'Alimentación', icon: Utensils },
  { value: 'parqueadero', label: 'Parqueadero', icon: ParkingSquare },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench },
  { value: 'reparacion', label: 'Reparación', icon: Hammer },
  { value: 'otro', label: 'Otro', icon: Receipt },
]

export const ETIQUETA_TIPO = Object.fromEntries(TIPOS_GASTO.map((t) => [t.value, t.label]))

export const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
