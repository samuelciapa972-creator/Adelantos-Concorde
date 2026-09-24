import React from 'react'
import ReactDOM from 'react-dom/client'
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import { FiltroAntiOCR } from './components/ui/TextoProtegido'
import './index.css'

// Los errores de mutaciones sin mensaje propio (legalizar, eliminar…) se avisan con un toast.
// Los formularios que muestran su error en línea lo marcan con meta: { inline: true }.
const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.inline) return
      window.dispatchEvent(new CustomEvent('app:error', { detail: error.message }))
    },
  }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <FiltroAntiOCR />
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)

// PWA: el service worker solo se registra en producción (en desarrollo estorba al recargar)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* la app funciona igual sin él */ })
  })
}
