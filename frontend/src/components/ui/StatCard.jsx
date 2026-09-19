const TONOS = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  bad: 'text-bad',
}

export default function StatCard({ label, value, hint, tone = 'neutral', icon: Icon }) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
        {Icon && <Icon size={16} className="text-ink-mute" aria-hidden="true" />}
      </div>
      <p className={`mt-2 font-display font-semibold text-[30px] leading-none ${TONOS[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-ink-mute mt-2">{hint}</p>}
    </div>
  )
}
