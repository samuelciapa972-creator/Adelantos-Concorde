import { createContext, useContext, useState, useEffect, useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMeses } from '../api'
import type { Mes } from '../types'

interface MesValor {
  mesId: number | null
  setMesId: Dispatch<SetStateAction<number | null>>
  vehiculoId: number | null
  setVehiculoId: Dispatch<SetStateAction<number | null>>
  mes: Mes | null
  meses: Mes[]
  cerrado: boolean
}

interface Guardado {
  mesId?: number | null
  vehiculoId?: number | null
}

const MesContext = createContext<MesValor | null>(null)
const CLAVE = 'viaticos.contexto'

function leer(): Guardado {
  try { return (JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Guardado | null) ?? {} } catch { return {} }
}

export function MesProvider({ children }: { children: ReactNode }) {
  const [{ mesId: mesGuardado, vehiculoId: vehGuardado }] = useState(leer)
  const [mesId, setMesId] = useState<number | null>(mesGuardado ?? null)
  const [vehiculoId, setVehiculoId] = useState<number | null>(vehGuardado ?? null)

  const { data: meses = [], isSuccess } = useQuery({ queryKey: ['meses'], queryFn: getMeses })

  // Si no hay mes elegido (o el guardado ya no existe), se toma el más reciente.
  useEffect(() => {
    if (!isSuccess) return
    const [masReciente] = meses
    if (!masReciente) return setMesId(null)
    if (!meses.some((m) => m.id === mesId)) setMesId(masReciente.id)
  }, [isSuccess, meses, mesId])

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ mesId, vehiculoId })) } catch { /* sin almacenamiento */ }
  }, [mesId, vehiculoId])

  const mes = useMemo(() => meses.find((m) => m.id === mesId) ?? null, [meses, mesId])
  const cerrado = Boolean(mes?.cerrado)

  const value = useMemo<MesValor>(
    () => ({ mesId, setMesId, vehiculoId, setVehiculoId, mes, meses, cerrado }),
    [mesId, vehiculoId, mes, meses, cerrado],
  )

  return <MesContext.Provider value={value}>{children}</MesContext.Provider>
}

export function useMes() {
  const ctx = useContext(MesContext)
  if (!ctx) throw new Error('useMes debe usarse dentro de MesProvider')
  return ctx
}
