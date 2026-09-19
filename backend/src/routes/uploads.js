const express = require('express');
const fs = require('fs');
const upload = require('../middleware/upload');
const { contenidoValido, rutaPublica, registrarArchivo } = require('../utils/archivos');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    ok: true,
    mensaje: 'Ruta uploads funcionando'
  });
});

router.post(
  '/',
  upload.single('archivo'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibió ningún archivo (campo "archivo")',
      });
    }

    if (!contenidoValido(req.file)) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        ok: false,
        error: 'El contenido del archivo no corresponde a su tipo (jpg, png, webp o pdf)',
      });
    }

    registrarArchivo(req.file.filename, req.usuario.id);
    res.json({
      ok: true,
      data: {
        nombre: req.file.filename,
        ruta: rutaPublica(req.file.filename),
      },
    });
  }
);

module.exports = router;
