import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMeses } from '../api'

const MesContext = createContext(null)
const CLAVE = 'viaticos.contexto'

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) ?? {} } catch { return {} }
}

export function MesProvider({ children }) {
  const [{ mesId: mesGuardado, vehiculoId: vehGuardado }] = useState(leer)
  const [mesId, setMesId] = useState(mesGuardado ?? null)
  const [vehiculoId, setVehiculoId] = useState(vehGuardado ?? null)

  const { data: meses = [], isSuccess } = useQuery({ queryKey: ['meses'], queryFn: getMeses })

  // Si no hay mes elegido (o el guardado ya no existe), se toma el más reciente.
  useEffect(() => {
    if (!isSuccess) return
    if (meses.length === 0) return setMesId(null)
    if (!meses.some((m) => m.id === mesId)) setMesId(meses[0].id)
  }, [isSuccess, meses, mesId])

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ mesId, vehiculoId })) } catch { /* sin almacenamiento */ }
  }, [mesId, vehiculoId])

  const mes = useMemo(() => meses.find((m) => m.id === mesId) ?? null, [meses, mesId])
  const cerrado = Boolean(mes?.cerrado)

  const value = useMemo(
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
