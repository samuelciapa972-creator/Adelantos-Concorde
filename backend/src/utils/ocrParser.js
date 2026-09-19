/**
 * Convierte el texto que devuelve el OCR de un soporte (factura, tiquete, recibo)
 * en los datos que necesita un gasto. Pensado para el formato colombiano:
 * pesos sin decimales con punto de miles ($ 332.800), fechas día/mes/año y NIT.
 *
 * Cada dato lleva una confianza: 'alta' | 'media' | 'baja'. La app móvil muestra
 * lo detectado para que el conductor lo confirme o lo corrija; nunca se guarda solo.
 */

const MESES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const lineasDe = (texto) => texto.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);

// ── Importes ────────────────────────────────────────────────────────────────

/** "332.800" | "332,800" | "$ 332.800,00" | "1.234.567" → número en pesos, o null */
function parseMonto(bruto) {
  let s = String(bruto).replace(/[^\d.,\s]/g, '').trim();
  if (!s) return null;
  s = s.replace(/\s+(?=\d{3}(?:\D|$))/g, ''); // "332 800" → "332800"
  s = s.replace(/\s+/g, '');
  if (!/\d/.test(s)) return null;

  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');
  let entero = s;
  let decimales = '';

  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // Ambos: el último es el decimal, el otro es el separador de miles
    const sepDec = ultimoPunto > ultimaComa ? '.' : ',';
    const i = s.lastIndexOf(sepDec);
    entero = s.slice(0, i).replace(/[.,]/g, '');
    decimales = s.slice(i + 1);
  } else if (ultimoPunto >= 0 || ultimaComa >= 0) {
    const sep = ultimoPunto >= 0 ? '.' : ',';
    const partes = s.split(sep);
    const ultima = partes[partes.length - 1];
    if (partes.length > 2 || ultima.length === 3) {
      entero = partes.join(''); // separador de miles
    } else {
      entero = partes[0]; // decimal: ",00" / ".5"
      decimales = ultima;
    }
  }

  const n = Number(entero.replace(/\D/g, '') + (decimales && Number(decimales) ? '.' + decimales.replace(/\D/g, '') : ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Un token con pinta de dinero: opcional $/S/§, miles con punto/coma/espacio, decimales opcionales
const TOKEN_MONTO = /(?:[$S§]\s?)?(?<![\d.,])\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?(?![\d])|(?:[$S§]\s?)?(?<![\d.,])\d{3,9}(?:[.,]\d{1,2})?(?![\d.,])/g;

// El OCR confunde a menudo letras y números dentro de una cifra
const arreglarDigitos = (linea) =>
  linea.replace(/[\dOoIl][\dOoIl.,]{2,}[\dOoIl]/g, (m) => (/\d/.test(m) ? m.replace(/[Oo]/g, '0').replace(/[Il]/g, '1') : m));

const RE_TOTAL_FUERTE = /\b(total\s*a\s*pagar|valor\s*total|vr\.?\s*total|total\s*factura|total\s*general|neto\s*a\s*pagar|importe\s*total|valor\s*a\s*pagar|valor\s*pagado|total\s*pagado|total\s*venta|total|t0tal)\b/i;
const RE_TARIFA = /\b(tarifa|valor\s*peaje|valor)\b/i;
const RE_EXCLUIR = /\b(subtotal|sub\s*total|iva|impuesto|impoconsumo|inc\b|cambio|vuelto|efectivo|recibido|entregado|propina|descuento|dcto|base|precio|cantidad|gravable|retenci[oó]n|nit|tel|cel|nro|no\.|resoluci[oó]n|autorizaci[oó]n|placa|kilometraje)\b/i;

function extraerValor(lineas) {
  const candidatos = [];

  lineas.forEach((linea, i) => {
    const limpia = arreglarDigitos(linea);
    const excluida = RE_EXCLUIR.test(sinTildes(limpia)) && !RE_TOTAL_FUERTE.test(limpia);
    const fuerte = RE_TOTAL_FUERTE.test(limpia) && !/sub\s*total/i.test(limpia);
    const tarifa = !fuerte && RE_TARIFA.test(limpia);

    let montos = [...limpia.matchAll(TOKEN_MONTO)].map((m) => parseMonto(m[0])).filter((v) => v && v >= 500);

    // "TOTAL" solo en la línea y la cifra en la siguiente (tiquetes en columnas)
    if (fuerte && montos.length === 0 && lineas[i + 1]) {
      montos = [...arreglarDigitos(lineas[i + 1]).matchAll(TOKEN_MONTO)].map((m) => parseMonto(m[0])).filter((v) => v && v >= 500);
    }

    montos.forEach((v) => {
      if (v > 50_000_000) return;
      let puntos = 1;
      if (fuerte) puntos = 10;
      else if (tarifa) puntos = 6;
      if (excluida) puntos = 0;
      // Lo más abajo suele ser el total; pequeño desempate por posición
      candidatos.push({ v, puntos: puntos + i / (lineas.length * 10), fuerte, tarifa, excluida });
    });
  });

  const validos = candidatos.filter((c) => !c.excluida);
  if (validos.length === 0) return null;

  const mejor = validos.reduce((a, b) => (b.puntos > a.puntos ? b : a));
  const fuertes = validos.filter((c) => c.fuerte);
  const distintos = new Set(fuertes.map((c) => c.v));

  let confianza = 'baja';
  if (mejor.fuerte) confianza = distintos.size === 1 ? 'alta' : 'media';
  else if (mejor.tarifa) confianza = 'media';

  // Sin palabra clave: el mayor importe plausible
  if (!mejor.fuerte && !mejor.tarifa) {
    const mayor = validos.reduce((a, b) => (b.v > a.v ? b : a));
    return { valor: mayor.v, confianza: 'baja' };
  }
  return { valor: mejor.v, confianza };
}

// ── Fechas ──────────────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function fechaValida(d, m, a, hoy) {
  if (a < 100) a += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null; // 31/02
  const dias = (f - hoy) / 86_400_000;
  if (dias > 2 || dias < -1100) return null; // ni futura ni de hace más de ~3 años
  return `${a}-${pad(m)}-${pad(d)}`;
}

function extraerFecha(lineas, hoy) {
  const encontradas = [];

  lineas.forEach((linea, i) => {
    const t = sinTildes(linea).toLowerCase();
    const conClave = /fecha|date|emision|expedicion/.test(t);
    const peso = (conClave ? 3 : 0) + (i < lineas.length / 2 ? 0.5 : 0);

    for (const m of t.matchAll(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g)) {
      const f = fechaValida(+m[3], +m[2], +m[1], hoy);
      if (f) encontradas.push({ f, peso: peso + 1, conClave });
    }
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/g)) {
      const f = fechaValida(+m[1], +m[2], +m[3], hoy); // Colombia: día/mes/año
      if (f) encontradas.push({ f, peso: peso + 1, conClave });
    }
    for (const m of t.matchAll(/(?<!\d)(\d{1,2})\s*(?:de\s*)?(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)[a-z]*\.?\s*(?:de|del)?\s*[-/]?\s*(\d{4}|\d{2})(?!\d)/g)) {
      const f = fechaValida(+m[1], MESES[m[2]], +m[3], hoy);
      if (f) encontradas.push({ f, peso: peso + 1, conClave });
    }
  });

  if (!encontradas.length) return null;
  const mejor = encontradas.reduce((a, b) => (b.peso > a.peso ? b : a));
  return { valor: mejor.f, confianza: mejor.conClave ? 'alta' : 'media' };
}

// ── NIT ─────────────────────────────────────────────────────────────────────

function extraerNit(texto) {
  const t = texto.replace(/\r?\n/g, '\n');
  const m = t.match(/\b(?:N\.?\s?I\.?\s?T\.?|nit)\s*[:.#]?\s*(\d{1,3}(?:[.\s]?\d{3}){2,3})\s*(?:[-–—.]\s*(\d))?(?!\d)/i);
  if (!m) return null;
  const base = m[1].replace(/\D/g, '');
  if (base.length < 8 || base.length > 10) return null;
  return { valor: m[2] ? `${base}-${m[2]}` : base, confianza: m[2] ? 'alta' : 'media' };
}

// ── Número de factura / recibo ──────────────────────────────────────────────

function extraerNumeroDocumento(lineas) {
  const re = /\b(?:factura(?:\s+(?:de\s+venta|electr[oó]nica|pos))?|fact\.?|recibo(?:\s+de\s+caja)?|tiquete|tique|ticket|comprobante|documento|cuenta\s+de\s+cobro)\b\s*(?:de\s+\w+\s*)?[:#.\s]*(?:n[o°º]\.?|nro\.?|num(?:ero)?\.?)?\s*[:#.\s]*([A-Z]{0,5}[-\s]?\d{3,12})\b/i;
  for (const linea of lineas) {
    if (/\bnit\b/i.test(linea)) continue;
    const m = sinTildes(linea).match(re);
    if (m) return { valor: m[1].replace(/\s+/g, ' ').trim().toUpperCase(), confianza: 'media' };
  }
  return null;
}

// ── Proveedor ───────────────────────────────────────────────────────────────

const RE_NO_PROVEEDOR = /\b(nit|fecha|factura|tel|cel|www|http|direcci[oó]n|resoluci[oó]n|regimen|r[eé]gimen|iva|cliente|cajero|hora|gracias)\b/i;
const RE_RAZON_SOCIAL = /\b(s\.?\s?a\.?\s?s\.?|s\.?\s?a\.?|ltda\.?|e\.?u\.?|s\.?\s?en\s?c\.?)\b/i;
const RE_TIPO_COMERCIO = /\b(estaci[oó]n|restaurante|hotel|hostal|parqueadero|taller|concesi[oó]n|peaje|almac[eé]n|droguer[ií]a|panader[ií]a|cafeter[ií]a|asadero|llantas|lubricentro|servicentro)\b/i;

const letras = (s) => (s.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g) ?? []).length;

function extraerProveedor(lineas) {
  const cabecera = lineas.slice(0, 8);
  const limpia = (l) => l.replace(/\bnit\b.*$/i, '').replace(/[|_~*=]+/g, ' ').replace(/^[^A-Za-zÁÉÍÓÚÑ0-9]+|[^A-Za-zÁÉÍÓÚÑ0-9.)]+$/g, '').replace(/\s+/g, ' ').trim();

  const opciones = cabecera
    .map((l) => ({ l, t: limpia(l) }))
    .filter(({ t }) => letras(t) >= 5 && letras(t) / t.length > 0.6 && !RE_NO_PROVEEDOR.test(sinTildes(t)));

  if (!opciones.length) return null;

  // Prefiere la razón social ("TERPEL S.A."), luego un comercio reconocible, luego la primera línea
  const elegido =
    opciones.find(({ t }) => RE_RAZON_SOCIAL.test(t)) ??
    opciones.find(({ t }) => RE_TIPO_COMERCIO.test(sinTildes(t))) ??
    opciones[0];

  return { valor: elegido.t.slice(0, 100), confianza: RE_RAZON_SOCIAL.test(elegido.t) || RE_TIPO_COMERCIO.test(sinTildes(elegido.t)) ? 'media' : 'baja' };
}

// ── Tipo de gasto ───────────────────────────────────────────────────────────

const REGLAS_TIPO = [
  ['combustible', /\b(gasolina|acpm|diesel|di[eé]sel|combustible|gal(?:on(?:es)?)?|eds|estaci[oó]n de servicio|terpel|primax|biomax|texaco|mobil|esso|zeus|petrobras|extra|corriente|surtidor)\b/g],
  ['peaje', /\b(peaje|concesi[oó]n|invias|autopista|tarifa especial|categor[ií]a|caseta|telepeaje|recaudo)\b/g],
  ['hotel', /\b(hotel|hospedaje|alojamiento|habitaci[oó]n|posada|hostal|caba[nñ]a|noches?|alojado)\b/g],
  ['alimentacion', /\b(restaurante|almuerzo|desayuno|cena|comida|cafeter[ií]a|panader[ií]a|jugo|bebida|men[uú]|corrientazo|asadero|gaseosa|propina|sopa|bandeja|hamburguesa|pollo)\b/g],
  ['parqueadero', /\b(parqueadero|parqueo|estacionamiento|parking|garaje|bah[ií]a)\b/g],
  ['reparacion', /\b(reparaci[oó]n|soldadura|latoner[ií]a|alineaci[oó]n|balanceo|pintura|mano de obra|electricidad automotriz|frenos?|embrague|suspensi[oó]n)\b/g],
  ['mantenimiento', /\b(taller|repuestos?|llantas?|lubricantes?|aceite|filtros?|mec[aá]nica|bater[ií]a|montallantas|lubricentro|lavadero|lavado|revisi[oó]n|tecnomec[aá]nica)\b/g],
];

function clasificarTipo(texto) {
  const t = sinTildes(texto).toLowerCase();
  const puntajes = REGLAS_TIPO.map(([tipo, re]) => ({ tipo, n: (t.match(new RegExp(sinTildes(re.source), 'g')) ?? []).length }));
  puntajes.sort((a, b) => b.n - a.n);
  const [primero, segundo] = puntajes;
  if (!primero || primero.n === 0) return { valor: 'otro', confianza: 'baja' };
  const margen = primero.n - (segundo?.n ?? 0);
  return { valor: primero.tipo, confianza: primero.n >= 2 && margen >= 1 ? 'alta' : 'media' };
}

// ── API ─────────────────────────────────────────────────────────────────────

/**
 * @param {string} texto  salida del OCR
 * @param {Date} [hoy]    para validar fechas (se inyecta en las pruebas)
 */
function extraerDatos(texto, hoy = new Date()) {
  const lineas = lineasDe(texto ?? '');
  const hoyUtc = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  const valor = extraerValor(lineas);
  const fecha = extraerFecha(lineas, hoyUtc);
  const nit = extraerNit(texto ?? '');
  const documento = extraerNumeroDocumento(lineas);
  const proveedor = extraerProveedor(lineas);
  const tipo = clasificarTipo(texto ?? '');

  return {
    valor: valor?.valor ?? null,
    fecha: fecha?.valor ?? null,
    tipo: tipo.valor,
    proveedor: proveedor?.valor ?? null,
    nit: nit?.valor ?? null,
    numero_documento: documento?.valor ?? null,
    confianza: {
      valor: valor?.confianza ?? null,
      fecha: fecha?.confianza ?? null,
      tipo: tipo.confianza,
      proveedor: proveedor?.confianza ?? null,
      nit: nit?.confianza ?? null,
      numero_documento: documento?.confianza ?? null,
    },
  };
}

module.exports = { extraerDatos, parseMonto };
