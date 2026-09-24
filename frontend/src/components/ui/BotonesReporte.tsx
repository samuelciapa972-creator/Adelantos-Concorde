import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useMes } from '../../context/MesContext'
import { useToast } from './Toast'
import { descargarReporte, type TipoReporte } from '../../api'

export default function BotonesReporte() {
  const { mesId, vehiculoId } = useMes()
  const toast = useToast()
  const [cargando, setCargando] = useState<TipoReporte | null>(null)

  if (!mesId) return null

  async function descargar(tipo: TipoReporte, mes: number) {
    setCargando(tipo)
    try {
      await descargarReporte(tipo, mes, vehiculoId)
      toast.ok(`Reporte ${tipo === 'excel' ? 'Excel' : 'PDF'} generado`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCargando(null)
    }
  }

  const botones: { tipo: TipoReporte; label: string; Icon: typeof FileText }[] = [
    { tipo: 'excel', label: 'Excel', Icon: FileSpreadsheet },
    { tipo: 'pdf', label: 'PDF', Icon: FileText },
  ]

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Descargar reporte del mes">
      {botones.map(({ tipo, label, Icon }) => (
        <button key={tipo} onClick={() => descargar(tipo, mesId)} disabled={cargando !== null} className="btn-secondary">
          {cargando === tipo ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {label}
        </button>
      ))}
    </div>
  )
}
