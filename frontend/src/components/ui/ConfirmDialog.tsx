import { TriangleAlert } from 'lucide-react'
import Modal from './Modal'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title, message, confirmLabel = 'Confirmar', tone = 'danger', busy = false, onConfirm, onCancel,
}: Props) {
  return (
    <Modal title={title} onClose={onCancel} size="sm">
      <div className="flex gap-3">
        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${tone === 'danger' ? 'bg-bad-soft text-bad' : 'bg-brand-50 text-brand-600'}`}>
          <TriangleAlert size={20} aria-hidden="true" />
        </div>
        <p className="text-sm text-ink-soft pt-1.5">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
