/**
 * Fuente única de la lógica de saldos.
 *
 * Los fragmentos SQL asumen estos alias en la consulta:
 *   f  = formularios
 *   g  = gastos (LEFT JOIN, con GROUP BY f.id)
 *   ct = conductor titular del vehículo
 *   cr = conductor relevador del vehículo
 */

// Total facturas = tasa_uso + hospedaje + mantenimiento + gastos
export const TOTAL_FACTURAS = `(f.tasa_uso + f.hospedaje + f.mantenimiento + COALESCE(SUM(g.valor), 0))`;

// Saldo real = anticipo - total_facturas
export const SALDO_REAL = `(f.anticipo - ${TOTAL_FACTURAS})`;

export const SALDOS_COLUMNS = `
    ${TOTAL_FACTURAS} AS total_facturas,
    ${SALDO_REAL} AS saldo_real,

    -- A favor de la empresa: el anticipo sobró
    CASE WHEN f.conductor_id = ct.id THEN MAX(0, ${SALDO_REAL}) ELSE 0 END AS saldo_empresa,
    CASE WHEN f.conductor_id = cr.id THEN MAX(0, ${SALDO_REAL}) ELSE 0 END AS saldo_empresa_relevador,

    -- A favor del conductor: los gastos superaron el anticipo
    CASE WHEN f.conductor_id = ct.id THEN MAX(0, -${SALDO_REAL}) ELSE 0 END AS saldo_conductor,
    CASE WHEN f.conductor_id = cr.id THEN MAX(0, -${SALDO_REAL}) ELSE 0 END AS saldo_relevador
`;

// Versión escalar (subconsulta) para resúmenes agrupados por vehículo,
// donde f no está agrupado por formulario.
export const TOTAL_FACTURAS_ESCALAR = `(
  f.tasa_uso + f.hospedaje + f.mantenimiento +
  COALESCE((SELECT SUM(g.valor) FROM gastos g WHERE g.formulario_id = f.id), 0)
)`;
