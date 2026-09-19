PRAGMA foreign_keys = ON;

-- =====================================================
-- CUENTAS CONTABLES
-- =====================================================

CREATE TABLE IF NOT EXISTS cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL
);

-- =====================================================
-- VEHICULOS
-- =====================================================

CREATE TABLE IF NOT EXISTS vehiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    numero_interno TEXT NOT NULL UNIQUE,
    placa TEXT NOT NULL UNIQUE,

    marca TEXT,
    modelo TEXT,
    color TEXT,

    cuenta_id INTEGER NOT NULL,

    activo INTEGER NOT NULL DEFAULT 1,

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (cuenta_id)
        REFERENCES cuentas(id)
);

-- =====================================================
-- CONDUCTORES
-- =====================================================

CREATE TABLE IF NOT EXISTS conductores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL UNIQUE,
    iniciales TEXT,

    licencia TEXT,

    tipo TEXT NOT NULL DEFAULT 'titular'
        CHECK(tipo IN ('titular','relevador')),

    activo INTEGER NOT NULL DEFAULT 1,

    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================================================
-- RELACION VEHICULO - CONDUCTOR
-- =====================================================

CREATE TABLE IF NOT EXISTS vehiculo_conductor (
    vehiculo_id INTEGER NOT NULL,
    conductor_id INTEGER NOT NULL,

    rol TEXT NOT NULL
        CHECK(rol IN ('titular','relevador')),

    PRIMARY KEY (
        vehiculo_id,
        conductor_id
    ),

    FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (conductor_id)
        REFERENCES conductores(id)
        ON DELETE CASCADE
);

-- =====================================================
-- MESES
-- =====================================================

CREATE TABLE IF NOT EXISTS meses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    nombre TEXT NOT NULL,
    anio INTEGER NOT NULL,

    cerrado INTEGER NOT NULL DEFAULT 0,

    UNIQUE(nombre, anio)
);

-- =====================================================
-- FORMULARIOS (ANTICIPOS)
-- =====================================================

CREATE TABLE IF NOT EXISTS formularios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    numero TEXT NOT NULL UNIQUE,

    fecha_dia INTEGER NOT NULL,

    conductor_id INTEGER NOT NULL,
    vehiculo_id INTEGER NOT NULL,
    mes_id INTEGER NOT NULL,

    fecha_salida TEXT,
    fecha_regreso TEXT,
    ruta TEXT DEFAULT '',

   anticipo  REAL NOT NULL DEFAULT 0,
   tasa_uso  REAL NOT NULL DEFAULT 0, 
   hospedaje     REAL NOT NULL DEFAULT 0,
   mantenimiento REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'sin_legalizar'
        CHECK(
            estado IN (
                'legalizado',
                'pendiente',
                'sin_legalizar'
            )
        ),

    notas TEXT DEFAULT '',

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (conductor_id)
        REFERENCES conductores(id),

    FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id),

    FOREIGN KEY (mes_id)
        REFERENCES meses(id)
);

-- =====================================================
-- GASTOS DEL ANTICIPO
-- =====================================================

CREATE TABLE IF NOT EXISTS gastos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    formulario_id INTEGER NOT NULL,

    fecha TEXT NOT NULL,

    tipo TEXT NOT NULL
        CHECK(
            tipo IN (
                'combustible',
                'peaje',
                'hotel',
                'alimentacion',
                'parqueadero',
                'mantenimiento',
                'reparacion',
                'otro'
            )
        ),

    concepto TEXT NOT NULL,

    valor REAL NOT NULL,

    observacion TEXT DEFAULT '',

    -- Ruta de la imagen recibo/factura
    soporte TEXT,

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (formulario_id)
        REFERENCES formularios(id)
        ON DELETE CASCADE
);
-- =====================================================
-- GASTOS GENERALES VEHICULO
-- =====================================================

CREATE TABLE IF NOT EXISTS gastos_vehiculo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    vehiculo_id INTEGER NOT NULL,
    mes_id INTEGER NOT NULL,

    fecha TEXT NOT NULL,

    tipo TEXT NOT NULL
        CHECK(
            tipo IN (
                'combustible',
                'mantenimiento',
                'reparacion',
                'llantas',
                'aceite',
                'tecnomecanica',
                'seguro',
                'otro'
            )
        ),

    valor REAL NOT NULL,

    notas TEXT DEFAULT '',

    creado_en TEXT NOT NULL DEFAULT (datetime('now')),

    FOREIGN KEY (vehiculo_id)
        REFERENCES vehiculos(id),

    FOREIGN KEY (mes_id)
        REFERENCES meses(id)
);

-- =====================================================
-- VISTA RESUMEN
-- =====================================================

CREATE VIEW IF NOT EXISTS vw_gastos AS
SELECT
    g.id,
    g.formulario_id,
    g.fecha,
    g.tipo,
    g.concepto,
    g.valor,
    g.observacion,
    g.soporte,
    g.creado_en,

    f.numero AS formulario_numero,

    c.nombre AS conductor,

    v.placa

FROM gastos g

INNER JOIN formularios f
ON f.id = g.formulario_id

INNER JOIN conductores c
ON c.id = f.conductor_id

INNER JOIN vehiculos v
ON v.id = f.vehiculo_id;

CREATE VIEW IF NOT EXISTS vw_resumen_formularios AS
SELECT
    f.id,
    f.numero,
    f.fecha_dia,

    c.nombre AS conductor,

    v.numero_interno,
    v.placa,

    cu.codigo AS cuenta,

    f.anticipo,

    COALESCE(SUM(g.valor),0) AS total_gastos,

    (
        f.anticipo -
        COALESCE(SUM(g.valor),0)
    ) AS saldo_real,

    CASE
        WHEN f.estado='legalizado'
        THEN 0

        ELSE (
            f.anticipo -
            COALESCE(SUM(g.valor),0)
        )
    END AS pendiente,

    f.estado

FROM formularios f

INNER JOIN conductores c
ON c.id = f.conductor_id

INNER JOIN vehiculos v
ON v.id = f.vehiculo_id

INNER JOIN cuentas cu
ON cu.id = v.cuenta_id

LEFT JOIN gastos g
ON g.formulario_id = f.id

GROUP BY f.id;