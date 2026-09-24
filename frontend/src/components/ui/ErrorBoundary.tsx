import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UI]', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="panel max-w-md p-8 text-center">
          <h1 className="text-2xl font-semibold text-ink">Algo salió mal</h1>
          <p className="text-sm text-ink-mute mt-2">
            Ocurrió un error inesperado al mostrar esta pantalla. Tus datos no se han perdido.
          </p>
          <button className="btn-primary mt-6" onClick={() => window.location.reload()}>Recargar la página</button>
        </div>
      </div>
    )
  }
}
