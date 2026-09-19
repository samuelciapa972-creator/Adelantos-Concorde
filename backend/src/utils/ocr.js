/**
 * Lectura de texto de fotos de soportes con Tesseract (local, sin internet).
 * El idioma español va empaquetado en @tesseract.js-data/spa.
 */
const path = require('path');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/spa/package.json')), '4.0.0_best_int');
const TIMEOUT_MS = 90_000;
const MAX_PIXELES = 80e6; // protege la memoria ante imágenes gigantes

let workerPromise = null;
let cola = Promise.resolve(); // Tesseract procesa de a una imagen; el resto espera turno
let enEspera = 0;
const MAX_EN_ESPERA = 6;

function obtenerWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('spa', 1, {
      langPath: LANG_PATH,
      gzip: true,
      cacheMethod: 'none',
    }).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

async function reiniciarWorker() {
  const p = workerPromise;
  workerPromise = null;
  try { (await p)?.terminate(); } catch { /* ya caído */ }
}

/**
 * Mejora la foto para el OCR: respeta la orientación EXIF, pasa a grises,
 * corrige el contraste y ajusta el tamaño (los tiquetes pequeños se amplían).
 */
async function prepararImagen(buffer) {
  const base = sharp(buffer, { limitInputPixels: MAX_PIXELES, failOn: 'none' }).rotate();
  const { width = 0 } = await base.clone().metadata();
  const destino = Math.min(2200, Math.max(1600, width));
  return base
    .resize({ width: destino, withoutEnlargement: false })
    .grayscale()
    .normalise()
    .sharpen({ sigma: 1 })
    .png()
    .toBuffer();
}

/** @returns {Promise<{texto: string, confianza: number}>} confianza 0–100 según Tesseract */
async function leerTexto(buffer) {
  if (enEspera >= MAX_EN_ESPERA) {
    throw Object.assign(new Error('El servidor está leyendo muchos soportes a la vez. Intenta de nuevo en unos segundos.'), { status: 503 });
  }
  const imagen = await prepararImagen(buffer);

  enEspera += 1;
  const tarea = cola.then(async () => {
    const worker = await obtenerWorker();
    const { data } = await worker.recognize(imagen);
    return { texto: data.text ?? '', confianza: data.confidence ?? 0 };
  });
  cola = tarea.catch(() => {}).finally(() => { enEspera -= 1; });

  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => {
      reiniciarWorker();
      reject(Object.assign(new Error('La lectura del soporte tardó demasiado'), { status: 504 }));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([tarea, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

async function cerrarOcr() {
  await reiniciarWorker();
}

module.exports = { leerTexto, cerrarOcr, prepararImagen };
