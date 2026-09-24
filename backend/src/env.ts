// Carga backend/.env si existe. Se importa antes que todo lo demás en index.ts,
// porque config.ts y database.ts leen process.env al cargarse.
import fs from 'node:fs';
import path from 'node:path';

const envFile = path.join(import.meta.dirname, '../.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
