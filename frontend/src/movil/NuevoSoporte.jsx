import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { Camera, Image as ImageIcon, RefreshCw, TriangleAlert, ScanLine, Sparkles, X } from 'lucide-react'

import { analizarSoporte, crearGastoMovil, getFormulariosMovil } from '../api'
import { comprimirImagen } from '../utils/imagen'
import { TIPOS_GASTO, ETIQUETA_TIPO, hoyISO } from '../utils/gastos'
import { useToast } from '../components/ui/Toast'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import MovilLayout from './MovilLayout'

const MAX_MB = 12 // se comprime antes de subir; este es el límite del archivo original

/** Marca de lo que la app leyó de la foto: «Leído» (fiable) o «Revisa» (dudoso). */
function Lectura({ nivel }) {
  if (!nivel) return null
  return nivel === 'alta'
    ? <span className="chip-ok !py-0.5 !text-[11px]">Leído</span>
    : <span className="chip-warn !py-0.5 !text-[11px]">Revisa</span>
}

function Campo({ id, etiqueta, nivel, ayuda, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink-soft">{etiqueta}</label>
        <Lectura nivel={nivel} />
      </div>
      {children}
      {ayuda && <p className="hint">{ayuda}</p>}
    </div>
  )
}

export default function NuevoSoporte({ onCambiarPassword }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()

  const { data: formularios = [], isLoading } = useQuery({ queryKey: ['movil', 'formularios'], queryFn: getFormulariosMovil })
  const formulario = formularios.find((x) => String(x.id) === id)

  const [fase, setFase] = useState('foto') // foto → leyendo → revisar
  const [local, setLocal] = useState(null) // { file, url }
  const [resultado, setResultado] = useState(null)
  const [errorLectura, setErrorLectura] = useState('')
  const [ampliar, setAmpliar] = useState(false)
  const [duplicado, setDuplicado] = useState(null)

  const [f, setF] = useState({ valor: '', fecha: hoyISO(), tipo: 'otro', proveedor: '', nit: '', numero_documento: '', observacion: '' })
  const [conceptoManual, setConceptoManual] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const camaraRef = useRef(null)
  const galeriaRef = useRef(null)

  useEffect(() => () => { if (local?.url) URL.revokeObjectURL(local.url) }, [local])

  const sugerido = useMemo(() => {
    const etiqueta = ETIQUETA_TIPO[f.tipo] ?? 'Gasto'
    return f.proveedor.trim() ? `${etiqueta} · ${f.proveedor.trim()}` : etiqueta
  }, [f.tipo, f.proveedor])
  const concepto = conceptoManual ?? sugerido

  async function procesar(file) {
    setErrorLectura('')
    if (!file) return
    if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) return setErrorLectura('Elige una foto (JPG o PNG) o un PDF.')
    if (file.size > MAX_MB * 1024 * 1024) return setErrorLectura(`El archivo pesa más de ${MAX_MB} MB.`)

    setFase('leyendo')
    try {
      const listo = await comprimirImagen(file)
      setLocal({ file: listo, url: listo.type.startsWith('image/') ? URL.createObjectURL(listo) : null })
      const r = await analizarSoporte(listo)
      setResultado(r)

      const x = r.extraido
      setF({
        valor: x?.valor != null ? String(x.valor) : '',
        fecha: x?.fecha ?? hoyISO(),
        tipo: x?.tipo ?? 'otro',
        proveedor: x?.proveedor ?? '',
        nit: x?.nit ?? '',
        numero_documento: x?.numero_documento ?? '',
        observacion: '',
      })
      setConceptoManual(null)
      setFase('revisar')
    } catch (err) {
      setErrorLectura(err.message)
      setFase('foto')
    }
  }

  const onArchivo = (e) => { const file = e.target.files?.[0]; e.target.value = ''; procesar(file) }

  const reintentar = () => { setFase('foto'); setResultado(null); setLocal(null); setErrorLectura('') }

  const guardar = useMutation({
    meta: { inline: true },
    mutationFn: (confirmar) => crearGastoMovil({
      formulario_id: Number(id),
      fecha: f.fecha,
      tipo: f.tipo,
      concepto: concepto.trim(),
      valor: Number(f.valor),
      observacion: f.observacion.trim(),
      proveedor: f.proveedor.trim() || null,
      nit: f.nit.trim() || null,
      numero_documento: f.numero_documento.trim() || null,
      soporte: resultado.archivo,
      ocr_confianza: resultado.ocr?.confianza ?? null,
      ...(confirmar ? { confirmar_duplicado: true } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['movil'] })
      toast.ok('Soporte guardado')
      navigate(`/f/${id}`, { replace: true })
    },
    onError: (err) => { if (err.codigo === 'POSIBLE_DUPLICADO') setDuplicado(err.message) },
  })

  if (!isLoading && (!formulario || !formulario.editable)) return <Navigate to={`/f/${id}`} replace />

  const valorNum = Number(f.valor)
  const puedeGuardar = valorNum > 0 && f.fecha && concepto.trim().length > 0 && !guardar.isPending
  const confianza = resultado?.extraido?.confianza ?? {}
  const huboLectura = resultado?.extraido && (resultado.extraido.valor != null || resultado.extraido.fecha != null)

  return (
    <MovilLayout titulo="Nuevo soporte" atras={`/f/${id}`} onCambiarPassword={onCambiarPassword}>
      {/* ── 1. Foto ── */}
      {fase === 'foto' && (
        <section aria-label="Tomar la foto">
          <p className="text-sm text-ink-soft mb-4">Fotografía la factura o el recibo. La app leerá el valor, la fecha y el comercio; tú solo confirmas.</p>

          <input ref={camaraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onArchivo} aria-label="Tomar foto con la cámara" />
          <input ref={galeriaRef} type="file" accept="image/*,application/pdf" className="sr-only" onChange={onArchivo} aria-label="Elegir archivo de la galería" />

          <button onClick={() => camaraRef.current?.click()} className="w-full rounded-2xl bg-night text-white p-8 flex flex-col items-center gap-3 active:scale-[0.99] transition-transform shadow-card">
            <span className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center"><Camera size={32} aria-hidden="true" /></span>
            <span className="font-display text-2xl font-semibold">Tomar foto</span>
            <span className="text-sm text-zinc-400">Abre la cámara del celular</span>
          </button>

          <button onClick={() => galeriaRef.current?.click()} className="btn-secondary btn-lg w-full mt-3"><ImageIcon size={20} aria-hidden="true" />Elegir de la galería</button>

          {errorLectura && <p role="alert" className="mt-4 text-sm text-bad bg-bad-soft border border-bad/20 rounded-xl px-4 py-3">{errorLectura}</p>}

          <div className="mt-6 rounded-xl bg-surface-sunken p-4">
            <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-2"><Sparkles size={15} aria-hidden="true" />Para que se lea bien</p>
            <ul className="text-sm text-ink-soft space-y-1 list-disc pl-5">
              <li>Con buena luz, sin sombras ni reflejos.</li>
              <li>Que se vea completo el tiquete, con el <strong>total</strong>.</li>
              <li>Recto y sin dedos encima. Si está arrugado, alísalo.</li>
            </ul>
          </div>
        </section>
      )}

      {/* ── 2. Leyendo ── */}
      {fase === 'leyendo' && (
        <section aria-live="polite" className="text-center py-10">
          {local?.url && <img src={local.url} alt="Foto del soporte" className="mx-auto max-h-64 rounded-xl border border-line shadow-card mb-6" />}
          <div className="mx-auto w-14 h-14 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-4"><ScanLine size={26} className="animate-pulse" aria-hidden="true" /></div>
          <p className="font-display text-2xl font-semibold">Leyendo el soporte…</p>
          <p className="text-sm text-ink-mute mt-1">Solo tarda unos segundos.</p>
        </section>
      )}

      {/* ── 3. Revisar y guardar ── */}
      {fase === 'revisar' && resultado && (
        <form onSubmit={(e) => { e.preventDefault(); if (puedeGuardar) guardar.mutate(false) }} className="pb-28 space-y-5">
          <div className="flex gap-3 items-start">
            {local?.url && (
              <button type="button" onClick={() => setAmpliar(true)} className="shrink-0 rounded-lg overflow-hidden border border-line w-20 h-20 bg-surface-sunken" aria-label="Ampliar la foto">
                <img src={local.url} alt="Foto del soporte" className="w-full h-full object-cover" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              {huboLectura ? (
                <p className="text-sm text-ink-soft"><strong className="text-ink">Esto es lo que se leyó.</strong> Revisa cada dato con la foto y corrige lo que haga falta antes de guardar.</p>
              ) : (
                <p role="status" className="text-sm text-warn flex gap-2"><TriangleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />{resultado.advertencia ?? 'No se pudo leer nada. Escribe los datos.'}</p>
              )}
              <button type="button" onClick={reintentar} className="mt-2 text-sm text-brand-600 font-medium flex items-center gap-1.5 min-h-[32px]"><RefreshCw size={14} aria-hidden="true" />Tomar otra foto</button>
            </div>
          </div>

          <Campo id="ns-valor" etiqueta="Valor total (COP)" nivel={confianza.valor} ayuda={valorNum > 0 ? `$ ${valorNum.toLocaleString('es-CO')}` : undefined}>
            <input id="ns-valor" inputMode="numeric" pattern="[0-9]*" autoComplete="off" className="input input-lg font-display text-2xl font-semibold tabular-nums"
              value={f.valor} onChange={(e) => setF((x) => ({ ...x, valor: e.target.value.replace(/\D/g, '').slice(0, 9) }))} placeholder="0" required />
          </Campo>

          <Campo id="ns-fecha" etiqueta="Fecha del soporte" nivel={confianza.fecha}>
            <input id="ns-fecha" type="date" className="input input-lg" max={hoyISO()} value={f.fecha} onChange={set('fecha')} required />
          </Campo>

          <fieldset className="m-0 p-0 border-0">
            <div className="flex items-center justify-between mb-1.5">
              <legend className="text-sm font-medium text-ink-soft p-0">Tipo de gasto</legend>
              <Lectura nivel={confianza.tipo} />
            </div>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Tipo de gasto">
              {TIPOS_GASTO.map(({ value, label, icon: Icono }) => {
                const activo = f.tipo === value
                return (
                  <button key={value} type="button" role="radio" aria-checked={activo} onClick={() => setF((x) => ({ ...x, tipo: value }))}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[11px] leading-tight text-center min-h-[64px] transition-colors ${activo ? 'bg-brand-500 border-brand-500 text-white font-semibold' : 'bg-surface-raised border-line-strong text-ink-soft'}`}>
                    <Icono size={20} aria-hidden="true" />{label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <Campo id="ns-prov" etiqueta="Comercio o proveedor" nivel={confianza.proveedor}>
            <input id="ns-prov" className="input input-lg" maxLength={120} value={f.proveedor} onChange={set('proveedor')} placeholder="Ej.: Terpel El Porvenir" />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo id="ns-nit" etiqueta="NIT" nivel={confianza.nit}>
              <input id="ns-nit" className="input input-lg" inputMode="numeric" maxLength={20} value={f.nit} onChange={set('nit')} placeholder="900123456-7" />
            </Campo>
            <Campo id="ns-doc" etiqueta="N° de factura" nivel={confianza.numero_documento}>
              <input id="ns-doc" className="input input-lg" maxLength={40} value={f.numero_documento} onChange={set('numero_documento')} />
            </Campo>
          </div>

          <Campo id="ns-conc" etiqueta="Concepto" ayuda="Se arma solo con el tipo y el comercio; puedes cambiarlo.">
            <input id="ns-conc" className="input input-lg" maxLength={120} value={concepto} onChange={(e) => setConceptoManual(e.target.value)} required />
          </Campo>

          <Campo id="ns-obs" etiqueta="Observación (opcional)">
            <input id="ns-obs" className="input input-lg" maxLength={300} value={f.observacion} onChange={set('observacion')} />
          </Campo>

          {guardar.isError && guardar.error.codigo !== 'POSIBLE_DUPLICADO' && (
            <p role="alert" className="text-sm text-bad bg-bad-soft border border-bad/20 rounded-xl px-4 py-3">{guardar.error.message}</p>
          )}

          <div className="fixed bottom-0 inset-x-0 z-20 bg-gradient-to-t from-surface via-surface to-transparent pt-6 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <button type="submit" disabled={!puedeGuardar} className="btn-primary btn-lg w-full max-w-xl mx-auto flex shadow-pop">
              {guardar.isPending ? 'Guardando…' : `Guardar soporte${valorNum > 0 ? ` · $ ${valorNum.toLocaleString('es-CO')}` : ''}`}
            </button>
          </div>
        </form>
      )}

      {ampliar && local?.url && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setAmpliar(false)}>
          <button className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 btn-icon !w-11 !h-11 text-white bg-white/10 hover:!bg-white/20 hover:!text-white" aria-label="Cerrar"><X size={22} /></button>
          <img src={local.url} alt="Foto del soporte ampliada" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {duplicado && (
        <ConfirmDialog
          title="¿Factura repetida?"
          message={duplicado}
          confirmLabel="Es otro soporte, guardar"
          tone="primary"
          busy={guardar.isPending}
          onConfirm={() => { setDuplicado(null); guardar.mutate(true) }}
          onCancel={() => setDuplicado(null)}
        />
      )}
    </MovilLayout>
  )
}
