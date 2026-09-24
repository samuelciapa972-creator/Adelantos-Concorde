// Arranca backend (API) y frontend (Vite) con un solo comando. Ctrl+C detiene ambos.
//   npm run dev
//   WEB_PORT=5180 API_PORT=3010 npm run dev     (si los puertos por defecto están ocupados)
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import path from 'node:path'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEB_PORT = Number(process.env.WEB_PORT ?? 5173)
const API_PORT = Number(process.env.API_PORT ?? 3001)
type Servicio = 'api' | 'web'
const COLOR: Record<Servicio | 'reset', string> = { api: '\x1b[36m', web: '\x1b[35m', reset: '\x1b[0m' }
const esWindows = process.platform === 'win32'

for (const dir of ['backend', 'frontend']) {
  if (!existsSync(path.join(raiz, dir, 'node_modules'))) {
    console.error(`\n✖ Faltan las dependencias de ${dir}. Ejecuta primero:  npm run setup\n`)
    process.exit(1)
  }
}

// ¿Alguien ya escucha en ese puerto? (localhost puede ser IPv4 o IPv6)
function ocupado(puerto: number): Promise<boolean> {
  const probar = (host: string) => new Promise<boolean>((ok) => {
    const s = net.connect({ port: puerto, host })
    s.once('connect', () => { s.destroy(); ok(true) })
    s.once('error', () => ok(false))
    s.setTimeout(500, () => { s.destroy(); ok(false) })
  })
  return Promise.all([probar('127.0.0.1'), probar('::1')]).then((r) => r.some(Boolean))
}

const ocupados: [string, string, number][] = []
if (await ocupado(API_PORT)) ocupados.push(['API', 'API_PORT', API_PORT])
if (await ocupado(WEB_PORT)) ocupados.push(['web', 'WEB_PORT', WEB_PORT])
if (ocupados.length) {
  console.error('')
  for (const [n, v, p] of ocupados) console.error(`✖ El puerto ${p} (${n}) ya está en uso: probablemente ya hay un "npm run dev" abierto.`)
  console.error('  Ciérralo, o usa otros puertos:  WEB_PORT=5180 API_PORT=3010 npm run dev\n')
  process.exit(1)
}

const env = {
  ...process.env,
  FORCE_COLOR: '1',
  PORT: String(API_PORT),
  API_PORT: String(API_PORT),
  WEB_PORT: String(WEB_PORT),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? `http://localhost:${WEB_PORT}`,
}

const hijos: ChildProcess[] = []
let saliendo = false

function lanzar(nombre: Servicio, carpeta: string): void {
  const p = spawn('npm', ['--prefix', carpeta, 'run', 'dev'], {
    cwd: raiz,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: esWindows,
    detached: !esWindows, // grupo de procesos propio: se puede detener todo el árbol
  })
  const prefijo = `${COLOR[nombre]}[${nombre}]${COLOR.reset} `
  const escribir = (flujo: NodeJS.WriteStream) => (buf: Buffer) =>
    buf.toString().split('\n').filter(Boolean).forEach((l) => flujo.write(prefijo + l + '\n'))
  p.stdout?.on('data', escribir(process.stdout))
  p.stderr?.on('data', escribir(process.stderr))
  p.on('exit', (codigo) => {
    if (!saliendo) {
      console.error(`${prefijo}terminó (código ${codigo}). Deteniendo el resto…`)
      apagar(codigo || 1)
    }
  })
  hijos.push(p)
}

// npm no reenvía las señales a sus hijos (vite, node --watch…): se detiene el grupo completo.
function matar(h: ChildProcess): void {
  if (h.pid === undefined) return
  try {
    if (esWindows) spawnSync('taskkill', ['/pid', String(h.pid), '/T', '/F'])
    else process.kill(-h.pid, 'SIGTERM')
  } catch { /* ya terminó */ }
}

function apagar(codigo = 0): void {
  if (saliendo) return
  saliendo = true
  hijos.forEach(matar)
  setTimeout(() => process.exit(codigo), 500)
}
process.on('SIGINT', () => apagar(0))
process.on('SIGTERM', () => apagar(0))

lanzar('api', 'backend')
lanzar('web', 'frontend')

setTimeout(() => {
  if (!saliendo) console.log(`\n  ➜  Abre  http://localhost:${WEB_PORT}   (API en http://localhost:${API_PORT})\n`)
}, 3000)
