-- Cuentas de conductores para la app móvil ─────────────────────────────────────
ALTER TABLE usuarios ADD COLUMN rol TEXT NOT NULL DEFAULT 'admin' CHECK (rol IN ('admin', 'conductor'));
ALTER TABLE usuarios ADD COLUMN conductor_id INTEGER REFERENCES conductores(id);
ALTER TABLE usuarios ADD COLUMN debe_cambiar_password INTEGER NOT NULL DEFAULT 0;

-- Un conductor tiene como máximo una cuenta
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_conductor ON usuarios (conductor_id) WHERE conductor_id IS NOT NULL;

-- Quién subió cada archivo: un conductor solo puede ver los que subió él
CREATE TABLE IF NOT EXISTS archivos (
    nombre TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Datos del soporte de cada gasto ───────────────────────────────────────────────
ALTER TABLE gastos ADD COLUMN proveedor TEXT;
ALTER TABLE gastos ADD COLUMN nit TEXT;
ALTER TABLE gastos ADD COLUMN numero_documento TEXT;
ALTER TABLE gastos ADD COLUMN creado_por INTEGER REFERENCES usuarios(id);
ALTER TABLE gastos ADD COLUMN origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'app_movil'));
-- Confianza media (0–100) del OCR cuando el gasto se creó desde una foto
ALTER TABLE gastos ADD COLUMN ocr_confianza REAL;

CREATE INDEX IF NOT EXISTS ix_formularios_conductor ON formularios (conductor_id, mes_id);
