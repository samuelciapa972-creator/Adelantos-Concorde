-- Un vehículo solo puede tener un titular y un relevador.
CREATE UNIQUE INDEX IF NOT EXISTS ux_vehiculo_conductor_rol
    ON vehiculo_conductor (vehiculo_id, rol);

-- Índices para las consultas más frecuentes.
CREATE INDEX IF NOT EXISTS ix_formularios_mes      ON formularios (mes_id);
CREATE INDEX IF NOT EXISTS ix_formularios_vehiculo ON formularios (vehiculo_id, mes_id);
CREATE INDEX IF NOT EXISTS ix_gastos_formulario    ON gastos (formulario_id);

-- Esta vista no la usa nadie y ignoraba hospedaje y mantenimiento.
DROP VIEW IF EXISTS vw_resumen_formularios;
