-- Registro de quién cambió qué (solo operaciones que modifican datos y accesos).
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    usuario TEXT,
    accion TEXT NOT NULL,
    ruta TEXT NOT NULL,
    estado_http INTEGER,
    ip TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ix_auditoria_fecha ON auditoria (creado_en);
