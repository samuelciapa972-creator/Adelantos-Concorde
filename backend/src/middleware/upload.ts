import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { HttpError } from '../utils/errores.ts';

const UPLOAD_DIR = path.join(import.meta.dirname, '../../uploads/recibos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_PERMITIDAS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  // El mimetype lo declara el cliente: se exige además que la extensión coincida.
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const extensiones = EXT_PERMITIDAS[file.mimetype];

    if (extensiones && extensiones.includes(ext)) {
      cb(null, true);
    } else {
      cb(new HttpError('Tipo de archivo no permitido (jpg, png, webp o pdf)', 400));
    }
  },
});

export default upload;
