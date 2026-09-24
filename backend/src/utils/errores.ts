/** Error con código HTTP: errorHandler lo convierte en { ok: false, error }. */
export class HttpError extends Error {
  status: number;

  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
  }
}
