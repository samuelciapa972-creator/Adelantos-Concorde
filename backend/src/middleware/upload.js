const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads/recibos');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT_PERMITIDAS = {
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

    cb(
      null,
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      ext
    );
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
      const err = new Error('Tipo de archivo no permitido (jpg, png, webp o pdf)');
      err.status = 400;
      cb(err);
    }
  },
});

module.exports = upload;
