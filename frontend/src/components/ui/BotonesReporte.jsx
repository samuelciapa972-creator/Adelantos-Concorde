import { useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { useMes } from '../../context/MesContext'
import { useToast } from './Toast'
import { descargarReporte } from '../../api'

export default function BotonesReporte() {
  const { mesId, vehiculoId } = useMes()
  const toast = useToast()
  const [cargando, setCargando] = useState(null)

  if (!mesId) return null

  async function descargar(tipo) {
    setCargando(tipo)
    try {
      await descargarReporte(tipo, mesId, vehiculoId)
      toast.ok(`Reporte ${tipo === 'excel' ? 'Excel' : 'PDF'} generado`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCargando(null)
    }
  }

  const botones = [
    { tipo: 'excel', label: 'Excel', Icon: FileSpreadsheet },
    { tipo: 'pdf', label: 'PDF', Icon: FileText },
  ]

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Descargar reporte del mes">
      {botones.map(({ tipo, label, Icon }) => (
        <button key={tipo} onClick={() => descargar(tipo)} disabled={cargando !== null} className="btn-secondary">
          {cargando === tipo ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {label}
        </button>
      ))}
    </div>
  )
}
