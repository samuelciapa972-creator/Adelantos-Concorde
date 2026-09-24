import { useMemo, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react'

// Texto legible para personas y lectores de pantalla, pero que llega desordenado y mezclado
// con señuelos a quien extrae textContent/innerHTML. Es un disuasivo, no una garantía:
// un navegador que renderiza la página y lee el árbol de accesibilidad obtiene el texto limpio.

const SEÑUELOS = 'aeiounrstlcdmpbgvhfyAEIOSNRTLCDM0123456789$.,'

// Varias formas de ocultar un señuelo, para que no baste una sola regla para filtrarlos
const OCULTOS: CSSProperties[] = [
  { position: 'absolute', opacity: 0, pointerEvents: 'none' },
  { fontSize: 0 },
  { position: 'absolute', transform: 'scale(0)' },
  { position: 'absolute', clipPath: 'inset(50%)' },
  { width: 0, overflow: 'hidden' },
]

const azar = (n: number): number => Math.floor(Math.random() * n)
const entre = (a: number, b: number): number => a + Math.random() * (b - a)

function barajar<T>(lista: T[]): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = azar(i + 1)
    ;[lista[i], lista[j]] = [lista[j]!, lista[i]!]
  }
  return lista
}

interface Pieza {
  c: string
  style: CSSProperties
}

type Fragmento = { key: string; espacio: true } | { key: string; espacio?: false; piezas: Pieza[] }

// Cada palabra es un inline-flex: sus letras van barajadas en el DOM y `order` las recoloca.
function fragmentar(texto: string): Fragmento[] {
  return texto.split(/(\s+)/).flatMap((palabra, p): Fragmento[] => {
    if (!palabra) return []
    if (/^\s+$/.test(palabra)) return [{ espacio: true, key: `s${p}` }]

    const piezas: Pieza[] = [...palabra].map((c, i) => ({
      c,
      style: {
        order: i * 2,
        // Micro-desplazamientos: invisibles al leer, estorban la segmentación del OCR
        transform: `translateY(${entre(-0.6, 0.6).toFixed(2)}px) rotate(${entre(-1.5, 1.5).toFixed(1)}deg)`,
      },
    }))
    const nSeñuelos = Math.max(1, Math.round(palabra.length * 0.8))
    for (let k = 0; k < nSeñuelos; k++) {
      piezas.push({
        c: SEÑUELOS[azar(SEÑUELOS.length)] ?? 'a',
        // Orden impar: nunca queda primero, así la línea base de la palabra la fija una letra real
        style: { order: azar(palabra.length) * 2 + 1, ...OCULTOS[azar(OCULTOS.length)] },
      })
    }
    return [{ key: `p${p}`, piezas: barajar(piezas) }]
  })
}

interface Props extends HTMLAttributes<HTMLElement> {
  /** Etiqueta que envuelve el texto (h1, p, span…). */
  as?: ElementType
  children?: ReactNode
}

export default function TextoProtegido({ as: Tag = 'span', children, className, ...rest }: Props) {
  const texto = typeof children === 'string' || typeof children === 'number' ? String(children) : null
  const palabras = useMemo(() => (texto ? fragmentar(texto) : null), [texto])

  // Contenido JSX (enlaces, negritas…) se deja tal cual
  if (texto === null || !palabras) return <Tag className={className} {...rest}>{children}</Tag>

  return (
    <Tag className={className} translate="no" {...rest}>
      {/* role="img" + aria-label: el lector de pantalla anuncia el texto real y omite los fragmentos */}
      <span role="img" aria-label={texto} className="protegido">
        {palabras.map((w) =>
          w.espacio ? (
            <span key={w.key} aria-hidden="true"> </span>
          ) : (
            <span key={w.key} aria-hidden="true" className="protegido-palabra">
              {w.piezas.map((pz, i) => <span key={i} style={pz.style}>{pz.c}</span>)}
            </span>
          )
        )}
      </span>
    </Tag>
  )
}

// Filtro SVG de distorsión mínima. Se monta una sola vez en la raíz de la app.
export function FiltroAntiOCR() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id="ruido-ocr" x="-2%" y="-15%" width="104%" height="130%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="7" result="ruido" />
        <feDisplacementMap in="SourceGraphic" in2="ruido" scale="0.9" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
