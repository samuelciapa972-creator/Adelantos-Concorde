import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH        = process.env.DB_PATH ?? path.join(import.meta.dirname, '../../data/viaticos.db');
const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');

// Garantiza que la carpeta data/ exista
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Rendimiento y consistencia
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/**
 * Aplica en orden las migraciones NNN_nombre.sql que aún no se hayan corrido.
 * Cada una corre en su propia transacción y queda registrada en schema_migrations.
 * Para cambiar el esquema: crear una migración nueva; no editar las ya aplicadas.
 */
function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre     TEXT PRIMARY KEY,
      aplicada_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const aplicadas = new Set(
    (db.prepare('SELECT nombre FROM schema_migrations').all() as { nombre: string }[]).map(r => r.nombre)
  );

  const pendientes = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => /^\d+_.+\.sql$/.test(f))
    .sort()
    .filter(f => !aplicadas.has(f));

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (nombre) VALUES (?)').run(archivo);
    })();
    console.log(`[db] migración aplicada: ${archivo}`);
  }
}

migrate();

export default db;
