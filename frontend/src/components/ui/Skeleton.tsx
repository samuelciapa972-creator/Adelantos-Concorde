export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

/** Marcador de carga para una página completa: encabezado + tarjetas + tabla. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-6">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
