import TextoProtegido from './TextoProtegido'

export default function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="px-6 py-14 text-center">
      {Icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-surface-sunken text-ink-mute flex items-center justify-center">
          <Icon size={26} aria-hidden="true" />
        </div>
      )}
      <TextoProtegido as="h3" className="text-lg font-semibold text-ink">{title}</TextoProtegido>
      {children && <TextoProtegido as="p" className="text-sm text-ink-mute mt-1.5 max-w-sm mx-auto">{children}</TextoProtegido>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
