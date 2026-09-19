const db = require('./database');

function conflicto(mensaje) {
  const err = new Error(mensaje);
  err.status = 409;
  return err;
}

/** Lanza 409 si el mes está cerrado (o 404 si no existe). */
function assertMesAbierto(mesId) {
  const mes = db.prepare('SELECT nombre, anio, cerrado FROM meses WHERE id = ?').get(mesId);
  if (!mes) {
    const err = new Error('Mes no encontrado');
    err.status = 404;
    throw err;
  }
  if (mes.cerrado) {
    throw conflicto(`El mes ${mes.nombre} ${mes.anio} está cerrado y no admite cambios`);
  }
}

/** Igual que assertMesAbierto, a partir de un formulario. */
function assertFormularioEditable(formularioId) {
  const f = db.prepare('SELECT mes_id FROM formularios WHERE id = ?').get(formularioId);
  if (!f) {
    const err = new Error('Formulario no encontrado');
    err.status = 404;
    throw err;
  }
  assertMesAbierto(f.mes_id);
}

module.exports = { assertMesAbierto, assertFormularioEditable };
