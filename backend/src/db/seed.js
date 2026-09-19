const db = require('./database');

function seed() {

  const insert = db.transaction(() => {

    // =====================================================
    // CUENTAS
    // =====================================================

    const insertCuenta = db.prepare(`
      INSERT OR IGNORE INTO cuentas (codigo, nombre) VALUES (?, ?)
    `);

    insertCuenta.run('33000', 'Cuenta Bus 33000');
    insertCuenta.run('37000', 'Cuenta Bus 37000');
    insertCuenta.run('3100',  'Cuenta Bus 3100');

    const getCuenta = codigo =>
      db.prepare('SELECT * FROM cuentas WHERE codigo = ?').get(codigo);

    // =====================================================
    // VEHICULOS
    // =====================================================

    const insertVehiculo = db.prepare(`
      INSERT OR IGNORE INTO vehiculos
        (numero_interno, placa, marca, modelo, color, cuenta_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertVehiculo.run('33000', 'TXB-420', 'Scania', 'K360', 'Blanco', getCuenta('33000').id);
    insertVehiculo.run('37000', 'SMK-837', 'Mercedes', 'O500', 'Blanco', getCuenta('37000').id);
    insertVehiculo.run('3100',  'PLR-195', 'Scania',   'K410', 'Blanco', getCuenta('3100').id);

    const getV = numero =>
      db.prepare('SELECT * FROM vehiculos WHERE numero_interno = ?').get(numero);

    // =====================================================
    // CONDUCTORES
    // =====================================================

    const insertConductor = db.prepare(`
      INSERT OR IGNORE INTO conductores (nombre, iniciales, licencia, tipo)
      VALUES (?, ?, ?, ?)
    `);

    // Bus 33000
    insertConductor.run('Mauricio Medina',   'MM', '123456', 'titular');
    insertConductor.run('Gabriel Barrera',   'GB', '654321', 'relevador');
    // Bus 37000 — pendiente por confirmar, se crean como placeholder
    insertConductor.run('Conductor T-37000', 'CT', '000001', 'titular');
    insertConductor.run('Conductor R-37000', 'CR', '000002', 'relevador');
    // Bus 3100
    insertConductor.run('Conductor T-3100',  'C3', '000003', 'titular');
    insertConductor.run('Conductor R-3100',  'C4', '000004', 'relevador');

    const getC = nombre =>
      db.prepare('SELECT * FROM conductores WHERE nombre = ?').get(nombre);

    // =====================================================
    // RELACIONES VEHÍCULO — CONDUCTOR
    // =====================================================

    const insertRelacion = db.prepare(`
      INSERT OR IGNORE INTO vehiculo_conductor (vehiculo_id, conductor_id, rol)
      VALUES (?, ?, ?)
    `);

    // Bus 33000
    insertRelacion.run(getV('33000').id, getC('Mauricio Medina').id,   'titular');
    insertRelacion.run(getV('33000').id, getC('Gabriel Barrera').id,   'relevador');
    // Bus 37000
    insertRelacion.run(getV('37000').id, getC('Conductor T-37000').id, 'titular');
    insertRelacion.run(getV('37000').id, getC('Conductor R-37000').id, 'relevador');
    // Bus 3100
    insertRelacion.run(getV('3100').id,  getC('Conductor T-3100').id,  'titular');
    insertRelacion.run(getV('3100').id,  getC('Conductor R-3100').id,  'relevador');

    // =====================================================
    // MESES
    // =====================================================

    const insertMes = db.prepare(`
      INSERT OR IGNORE INTO meses (nombre, anio) VALUES (?, ?)
    `);

    insertMes.run('Abril', 2024);
    insertMes.run('Mayo',  2024);
    insertMes.run('Junio', 2024);

    const getMes = (nombre, anio) =>
      db.prepare('SELECT * FROM meses WHERE nombre = ? AND anio = ?').get(nombre, anio);

    const mesAbril = getMes('Abril', 2024);
    const mesMayo  = getMes('Mayo',  2024);
    const mesJunio = getMes('Junio', 2024);

    // =====================================================
    // FORMULARIOS
    // =====================================================

    const insertFormulario = db.prepare(`
      INSERT OR IGNORE INTO formularios
        (numero, fecha_dia, conductor_id, vehiculo_id, mes_id,
         fecha_salida, fecha_regreso, anticipo, tasa_uso, ruta, estado, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const v33000 = getV('33000');
    const v37000 = getV('37000');
    const v3100  = getV('3100');
    const mm     = getC('Mauricio Medina');
    const gb     = getC('Gabriel Barrera');
    const ct37   = getC('Conductor T-37000');
    const cr37   = getC('Conductor R-37000');
    const ct31   = getC('Conductor T-3100');
    const cr31   = getC('Conductor R-3100');

    // ── Abril — Bus 33000 ──────────────────────────────
    insertFormulario.run('26778', 1,  mm.id,  v33000.id, mesAbril.id, '2024-04-01', '2024-04-02', 174000, 700,  'Cúcuta - Bogotá',  'legalizado',    '');
    insertFormulario.run('26779', 2,  gb.id,  v33000.id, mesAbril.id, '2024-04-02', '2024-04-03', 144000, 700,  'Bogotá - Cúcuta',  'legalizado',    '');
    insertFormulario.run('26780', 4,  mm.id,  v33000.id, mesAbril.id, '2024-04-04', '2024-04-05', 144000, 700,  'Cúcuta - Bogotá',  'pendiente',     'Faltan facturas');
    insertFormulario.run('26781', 6,  gb.id,  v33000.id, mesAbril.id, '2024-04-06', '2024-04-07', 152000, 700,  'Bogotá - Sogamoso','sin_legalizar', '');
    insertFormulario.run('26782', 9,  mm.id,  v33000.id, mesAbril.id, '2024-04-09', '2024-04-10', 322000, 1400, 'Cúcuta - Bogotá',  'legalizado',    '');
    insertFormulario.run('26783', 12, gb.id,  v33000.id, mesAbril.id, '2024-04-12', '2024-04-13', 144000, 700,  'Bogotá - Cúcuta',  'sin_legalizar', '');

    // ── Abril — Bus 37000 ──────────────────────────────
    insertFormulario.run('27001', 1,  ct37.id, v37000.id, mesAbril.id, '2024-04-01', '2024-04-02', 160000, 700,  'Bogotá - Medellín', 'legalizado',    '');
    insertFormulario.run('27002', 5,  cr37.id, v37000.id, mesAbril.id, '2024-04-05', '2024-04-06', 160000, 700,  'Medellín - Bogotá', 'pendiente',     'Pendiente soporte');
    insertFormulario.run('27003', 10, ct37.id, v37000.id, mesAbril.id, '2024-04-10', '2024-04-11', 200000, 1400, 'Bogotá - Medellín', 'sin_legalizar', '');

    // ── Abril — Bus 3100 ───────────────────────────────
    insertFormulario.run('28001', 2,  ct31.id, v3100.id, mesAbril.id, '2024-04-02', '2024-04-03', 130000, 700,  'Tunja - Bogotá',  'legalizado',    '');
    insertFormulario.run('28002', 7,  cr31.id, v3100.id, mesAbril.id, '2024-04-07', '2024-04-08', 130000, 700,  'Bogotá - Tunja',  'legalizado',    '');
    insertFormulario.run('28003', 14, ct31.id, v3100.id, mesAbril.id, '2024-04-14', '2024-04-15', 130000, 700,  'Tunja - Bogotá',  'sin_legalizar', '');

    // ── Mayo — Bus 33000 ───────────────────────────────
    insertFormulario.run('26790', 2,  mm.id, v33000.id, mesMayo.id, '2024-05-02', '2024-05-03', 174000, 700,  'Cúcuta - Bogotá',  'legalizado',    '');
    insertFormulario.run('26791', 5,  gb.id, v33000.id, mesMayo.id, '2024-05-05', '2024-05-06', 144000, 700,  'Bogotá - Cúcuta',  'pendiente',     '');
    insertFormulario.run('26792', 10, mm.id, v33000.id, mesMayo.id, '2024-05-10', '2024-05-11', 322000, 1400, 'Cúcuta - Bogotá',  'sin_legalizar', '');

    // ── Mayo — Bus 37000 ───────────────────────────────
    insertFormulario.run('27010', 3,  ct37.id, v37000.id, mesMayo.id, '2024-05-03', '2024-05-04', 160000, 700,  'Bogotá - Medellín', 'legalizado', '');
    insertFormulario.run('27011', 8,  cr37.id, v37000.id, mesMayo.id, '2024-05-08', '2024-05-09', 160000, 700,  'Medellín - Bogotá', 'legalizado', '');

    // ── Junio — Bus 33000 ──────────────────────────────
    insertFormulario.run('26800', 1,  mm.id, v33000.id, mesJunio.id, '2024-06-01', '2024-06-02', 174000, 700,  'Cúcuta - Bogotá', 'legalizado',    '');
    insertFormulario.run('26801', 3,  gb.id, v33000.id, mesJunio.id, '2024-06-03', '2024-06-04', 144000, 700,  'Bogotá - Cúcuta', 'sin_legalizar', '');

    // =====================================================
    // GASTOS
    // =====================================================

    const insertGasto = db.prepare(`
      INSERT INTO gastos (formulario_id, fecha, tipo, concepto, valor)
      VALUES (?, ?, ?, ?, ?)
    `);

    const getF = numero =>
      db.prepare('SELECT * FROM formularios WHERE numero = ?').get(numero);

    // Gastos formulario 26778
    const f26778 = getF('26778');
    insertGasto.run(f26778.id, '2024-04-01', 'combustible',  'Tanqueo Bucaramanga',  95000);
    insertGasto.run(f26778.id, '2024-04-01', 'peaje',        'Peaje La Variante',    18200);
    insertGasto.run(f26778.id, '2024-04-01', 'alimentacion', 'Almuerzo conductor',   22000);
    insertGasto.run(f26778.id, '2024-04-02', 'peaje',        'Peaje Chusacá',        15400);
    insertGasto.run(f26778.id, '2024-04-02', 'combustible',  'Tanqueo Bogotá',       23000);

    // Gastos formulario 26779
    const f26779 = getF('26779');
    insertGasto.run(f26779.id, '2024-04-02', 'combustible',  'Tanqueo Bogotá',       85000);
    insertGasto.run(f26779.id, '2024-04-02', 'peaje',        'Peaje Chusacá',        15400);
    insertGasto.run(f26779.id, '2024-04-03', 'alimentacion', 'Cena conductor',       25000);
    insertGasto.run(f26779.id, '2024-04-03', 'peaje',        'Peaje La Variante',    18200);

    // Gastos formulario 26782
    const f26782 = getF('26782');
    insertGasto.run(f26782.id, '2024-04-09', 'combustible',  'Tanqueo Bucaramanga', 110000);
    insertGasto.run(f26782.id, '2024-04-09', 'peaje',        'Peaje La Variante',    18200);
    insertGasto.run(f26782.id, '2024-04-09', 'alimentacion', 'Almuerzo conductor',   22000);
    insertGasto.run(f26782.id, '2024-04-10', 'combustible',  'Tanqueo Bogotá',       95000);
    insertGasto.run(f26782.id, '2024-04-10', 'peaje',        'Peaje Chusacá',        15400);
    insertGasto.run(f26782.id, '2024-04-10', 'hotel',        'Hotel Bogotá',         80000);
    insertGasto.run(f26782.id, '2024-04-10', 'alimentacion', 'Cena conductor',       25000);

    // Gastos formulario 27001
    const f27001 = getF('27001');
    insertGasto.run(f27001.id, '2024-04-01', 'combustible',  'Tanqueo Bogotá',       90000);
    insertGasto.run(f27001.id, '2024-04-01', 'peaje',        'Peaje La Manuela',     22000);
    insertGasto.run(f27001.id, '2024-04-02', 'alimentacion', 'Almuerzo conductor',   20000);
    insertGasto.run(f27001.id, '2024-04-02', 'combustible',  'Tanqueo Medellín',     18000);

    // Gastos formulario 28001
    const f28001 = getF('28001');
    insertGasto.run(f28001.id, '2024-04-02', 'combustible',  'Tanqueo Tunja',        60000);
    insertGasto.run(f28001.id, '2024-04-02', 'peaje',        'Peaje Albarracín',     12000);
    insertGasto.run(f28001.id, '2024-04-03', 'alimentacion', 'Almuerzo conductor',   18000);

    // Gastos formulario 26790 (Mayo)
    const f26790 = getF('26790');
    insertGasto.run(f26790.id, '2024-05-02', 'combustible',  'Tanqueo Bucaramanga', 100000);
    insertGasto.run(f26790.id, '2024-05-02', 'peaje',        'Peaje La Variante',    18200);
    insertGasto.run(f26790.id, '2024-05-03', 'alimentacion', 'Almuerzo conductor',   22000);
    insertGasto.run(f26790.id, '2024-05-03', 'peaje',        'Peaje Chusacá',        15400);

    console.log('✓ Seed ejecutado correctamente');
  });

  const count = db.prepare('SELECT COUNT(*) total FROM formularios').get();

  if (count.total > 0) {
    console.log('ℹ La base ya contiene información. Seed omitido.');
    return;
  }

  insert();
  console.log('\n✅ Base de datos poblada correctamente');
}

seed();