/**
 * Lectura de texto de fotos de soportes con Tesseract (local, sin internet).
 * El idioma español va empaquetado en @tesseract.js-data/spa.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { createWorker, type Worker } from 'tesseract.js';
import { HttpError } from './errores.ts';

const require = createRequire(import.meta.url);
const LANG_PATH = path.join(path.dirname(require.resolve('@tesseract.js-data/spa/package.json')), '4.0.0_best_int');
const TIMEOUT_MS = 90_000;
const MAX_PIXELES = 80e6; // protege la memoria ante imágenes gigantes

let workerPromise: Promise<Worker> | null = null;
let cola: Promise<unknown> = Promise.resolve(); // Tesseract procesa de a una imagen; el resto espera turno
let enEspera = 0;
const MAX_EN_ESPERA = 6;

function obtenerWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('spa', 1, {
      langPath: LANG_PATH,
      gzip: true,
      cacheMethod: 'none',
    }).catch((err) => { workerPromise = null; throw err; });
  }
  return workerPromise;
}

async function reiniciarWorker(): Promise<void> {
  const p = workerPromise;
  workerPromise = null;
  try { await (await p)?.terminate(); } catch { /* ya caído */ }
}

/**
 * Mejora la foto para el OCR: respeta la orientación EXIF, pasa a grises,
 * corrige el contraste y ajusta el tamaño (los tiquetes pequeños se amplían).
 */
export async function prepararImagen(buffer: Buffer): Promise<Buffer> {
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

export interface LecturaOcr {
  texto: string;
  /** 0–100 según Tesseract */
  confianza: number;
}

export async function leerTexto(buffer: Buffer): Promise<LecturaOcr> {
  if (enEspera >= MAX_EN_ESPERA) {
    throw new HttpError('El servidor está leyendo muchos soportes a la vez. Intenta de nuevo en unos segundos.', 503);
  }
  const imagen = await prepararImagen(buffer);

  enEspera += 1;
  const tarea = cola.then(async (): Promise<LecturaOcr> => {
    const worker = await obtenerWorker();
    const { data } = await worker.recognize(imagen);
    return { texto: data.text ?? '', confianza: data.confidence ?? 0 };
  });
  cola = tarea.catch(() => {}).finally(() => { enEspera -= 1; });

  let temporizador: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, reject) => {
    temporizador = setTimeout(() => {
      void reiniciarWorker();
      reject(new HttpError('La lectura del soporte tardó demasiado', 504));
    }, TIMEOUT_MS);
  });
  try {
    return await Promise.race([tarea, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

export async function cerrarOcr(): Promise<void> {
  await reiniciarWorker();
}

