/**
 * Crea un usuario o cambia su contraseña.
 *   npm run usuario -- <usuario> "<Nombre completo>"
 *   npm run usuario -- --listar
 *
 * La contraseña se toma, en este orden, de:
 *   1. la variable de entorno VIATICOS_PASSWORD
 *   2. la entrada estándar si viene por tubería:  echo "clave" | npm run usuario -- admin "Nombre"
 *   3. un aviso oculto en la terminal (solo funciona en una terminal interactiva)
 */
const readline = require('readline');
const db = require('./database');
const { hashPassword, PASSWORD_MIN } = require('../utils/auth');

function fallar(mensaje) {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

function pedirPassword(pregunta) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let respondido = false;
    rl._writeToOutput = (s) => { if (s.includes(pregunta)) rl.output.write(s); };
    rl.on('close', () => { if (!respondido) reject(new Error('Entrada cancelada.')); });
    rl.question(pregunta, (r) => { respondido = true; rl.output.write('\n'); rl.close(); resolve(r); });
  });
}

async function leerTuberia() {
  const trozos = [];
  for await (const t of process.stdin) trozos.push(t);
  return Buffer.concat(trozos).toString('utf8').split(/\r?\n/)[0];
}

async function obtenerPassword() {
  if (process.env.VIATICOS_PASSWORD) return process.env.VIATICOS_PASSWORD;

  if (!process.stdin.isTTY) {
    const desdeTuberia = await leerTuberia();
    if (desdeTuberia) return desdeTuberia;
    fallar(
      'No hay una terminal interactiva para pedir la contraseña, así que no se creó nada.\n' +
      '  Ejecútalo en una terminal normal (no con "!" dentro de Claude Code), o indica la clave así:\n' +
      '    VIATICOS_PASSWORD=\'tu-clave-larga\' npm run usuario -- admin "Nombre Apellido"'
    );
  }

  const password = await pedirPassword(`Contraseña (mínimo ${PASSWORD_MIN} caracteres): `);
  const repetir = await pedirPassword('Repite la contraseña: ');
  if (password !== repetir) fallar('Las contraseñas no coinciden. No se guardó nada.');
  return password;
}

async function main() {
  if (process.argv[2] === '--listar') {
    const filas = db.prepare('SELECT usuario, nombre, activo, creado_en FROM usuarios ORDER BY id').all();
    if (!filas.length) return console.log('No hay usuarios en la base de datos.');
    filas.forEach((u) => console.log(`${u.activo ? '●' : '○'} ${u.usuario}  (${u.nombre})  creado ${u.creado_en}`));
    return;
  }

  const [usuario, ...resto] = process.argv.slice(2);
  const nombre = resto.join(' ').trim();

  if (!usuario) fallar('Uso: npm run usuario -- <usuario> "<Nombre completo>"');

  const existente = db.prepare('SELECT id, nombre FROM usuarios WHERE usuario = ?').get(usuario);
  if (!existente && !nombre) fallar('Usuario nuevo: indica también el nombre completo entre comillas.');

  const password = await obtenerPassword();
  if (password.length < PASSWORD_MIN) fallar(`La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`);

  const hash = hashPassword(password);

  if (existente) {
    db.prepare('UPDATE usuarios SET password_hash = ?, nombre = ?, activo = 1 WHERE id = ?')
      .run(hash, nombre || existente.nombre, existente.id);
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(existente.id);
    console.log(`✔ Contraseña actualizada para "${usuario}" (sesiones anteriores cerradas).`);
  } else {
    db.prepare('INSERT INTO usuarios (usuario, nombre, password_hash) VALUES (?, ?, ?)')
      .run(usuario, nombre, hash);
    console.log(`✔ Usuario "${usuario}" creado. Inicia sesión con ese usuario (no con el nombre).`);
  }

  // Comprobación final: el usuario debe existir de verdad en la base
  const total = db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario).n;
  if (total !== 1) fallar('El usuario no quedó guardado. Revisa la ruta de la base de datos (DB_PATH).');
}

main().catch((err) => fallar(err.message));
