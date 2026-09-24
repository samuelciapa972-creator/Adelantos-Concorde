import '@tanstack/react-query'

declare module '@tanstack/react-query' {
  interface Register {
    // meta.inline: el formulario muestra el error en línea y no hace falta el aviso global (ver main.tsx)
    mutationMeta: { inline?: boolean }
  }
}
