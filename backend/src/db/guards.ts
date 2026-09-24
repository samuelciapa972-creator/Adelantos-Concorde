import db from './database.ts';
import { HttpError } from '../utils/errores.ts';

/** Lanza 409 si el mes está cerrado (o 404 si no existe). */
export function assertMesAbierto(mesId: number | string): void {
  const mes = db.prepare('SELECT nombre, anio, cerrado FROM meses WHERE id = ?').get(mesId) as
    | { nombre: string; anio: number; cerrado: number }
    | undefined;
  if (!mes) throw new HttpError('Mes no encontrado', 404);
  if (mes.cerrado) {
    throw new HttpError(`El mes ${mes.nombre} ${mes.anio} está cerrado y no admite cambios`, 409);
  }
}

/** Igual que assertMesAbierto, a partir de un formulario. */
export function assertFormularioEditable(formularioId: number | string): void {
  const f = db.prepare('SELECT mes_id FROM formularios WHERE id = ?').get(formularioId) as { mes_id: number } | undefined;
  if (!f) throw new HttpError('Formulario no encontrado', 404);
  assertMesAbierto(f.mes_id);
}
