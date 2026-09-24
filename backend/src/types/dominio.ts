// Tipos de las filas de la base de datos y del dominio de viáticos.
// Los booleanos de SQLite llegan como 0 | 1.

export type Rol = 'admin' | 'conductor';
export type RolVehiculo = 'titular' | 'relevador';
export type EstadoFormulario = 'legalizado' | 'pendiente' | 'sin_legalizar';

export const TIPOS_GASTO = [
  'combustible', 'peaje', 'hotel', 'alimentacion', 'parqueadero', 'mantenimiento', 'reparacion', 'otro',
] as const;
export type TipoGasto = (typeof TIPOS_GASTO)[number];

export type Bit = 0 | 1;

/** Lo que se sabe del usuario de la sesión (nunca incluye el hash). */
export interface UsuarioSesion {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  conductor_id: number | null;
  debe_cambiar_password: Bit;
}

export interface UsuarioFila extends UsuarioSesion {
  password_hash: string;
  activo: Bit;
  creado_en: string;
}

export interface Mes {
  id: number;
  nombre: string;
  anio: number;
  cerrado: Bit;
}

export interface Conductor {
  id: number;
  nombre: string;
  iniciales: string | null;
  licencia: string | null;
  tipo: RolVehiculo;
  activo: Bit;
  creado_en: string;
}

export interface Gasto {
  id: number;
  formulario_id: number;
  fecha: string;
  tipo: TipoGasto;
  concepto: string;
  valor: number;
  observacion: string | null;
  soporte: string | null;
  proveedor: string | null;
  nit: string | null;
  numero_documento: string | null;
  creado_por: number | null;
  origen: string;
  ocr_confianza: number | null;
  creado_en: string;
}

/** Columnas que añade SALDOS_COLUMNS (ver db/saldos.ts). */
export interface Saldos {
  total_facturas: number;
  saldo_real: number;
  saldo_empresa: number;
  saldo_empresa_relevador: number;
  saldo_conductor: number;
  saldo_relevador: number;
}

export interface Conteo {
  n: number;
}
