const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')

let win = null

/* ------------------------------------------------------------------ */
/* Configuración local (carpeta de respaldo)                           */
/* ------------------------------------------------------------------ */

const CONFIG = path.join(app.getPath('userData'), 'config.json')

function leerConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')) } catch { return {} }
}
function guardarConfig(c) {
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true })
  fs.writeFileSync(CONFIG, JSON.stringify(c, null, 2))
}

function carpetaRespaldo() {
  const c = leerConfig().carpeta
  return c && fs.existsSync(c) ? c : null
}

// Resuelve una ruta relativa impidiendo salir de la carpeta de respaldo
function rutaSegura(rel) {
  const base = carpetaRespaldo()
  if (!base) throw new Error('No hay carpeta de respaldo configurada')
  const destino = path.resolve(base, rel)
  if (destino !== base && !destino.startsWith(base + path.sep)) throw new Error('Ruta fuera de la carpeta de respaldo')
  return destino
}

function escribirAtomico(destino, datos) {
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  const tmp = `${destino}.${process.pid}.tmp`
  fs.writeFileSync(tmp, datos)
  fs.renameSync(tmp, destino)
}

ipcMain.handle('respaldo:carpeta', () => carpetaRespaldo())

ipcMain.handle('respaldo:sugerida', () => path.join(app.getPath('documents'), 'Evaluaciones de Comunicación'))

ipcMain.handle('respaldo:usar', (_e, carpeta) => {
  fs.mkdirSync(carpeta, { recursive: true })
  guardarConfig({ ...leerConfig(), carpeta })
  return carpeta
})

ipcMain.handle('respaldo:elegir', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Elige la carpeta donde se guardarán los respaldos',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (r.canceled || !r.filePaths[0]) return null
  guardarConfig({ ...leerConfig(), carpeta: r.filePaths[0] })
  return r.filePaths[0]
})

ipcMain.handle('respaldo:escribir', (_e, rel, datos) => {
  escribirAtomico(rutaSegura(rel), typeof datos === 'string' ? datos : Buffer.from(datos))
  return true
})

ipcMain.handle('respaldo:leer', (_e, rel) => {
  try { return fs.readFileSync(rutaSegura(rel), 'utf8') } catch { return null }
})

// Conserva solo los N archivos más recientes de una subcarpeta
ipcMain.handle('respaldo:rotar', (_e, rel, conservar) => {
  const dir = rutaSegura(rel)
  if (!fs.existsSync(dir)) return 0
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse()
  for (const f of archivos.slice(conservar)) fs.rmSync(path.join(dir, f))
  return Math.max(0, archivos.length - conservar)
})

ipcMain.handle('respaldo:abrir', () => {
  const c = carpetaRespaldo()
  if (c) shell.openPath(c)
})

/* ------------------------------------------------------------------ */
/* Servidor local para sincronizar con el celular (solo bajo demanda)  */
/* ------------------------------------------------------------------ */

const DURACION_MS = 15 * 60 * 1000
const PUERTO_PREFERIDO = 47831
let servidor = null
let sesion = null // { token, origenes, vence, timer }
const pendientes = new Map()

function ipsLocales() {
  const ips = []
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista ?? []) {
      if (i.family === 'IPv4' && !i.internal) ips.push(i.address)
    }
  }
  // redes domésticas típicas primero
  const peso = (ip) => (ip.startsWith('192.168.') ? 0 : ip.startsWith('10.') ? 1 : ip.startsWith('172.') ? 2 : 3)
  return ips.sort((a, b) => peso(a) - peso(b))
}

function avisar(evento, datos) {
  win?.webContents.send('sync:evento', { evento, ...datos })
}

function cabecerasCors(req, res) {
  const origen = req.headers.origin
  if (origen && sesion && sesion.origenes.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Token')
  // Private/Local Network Access (Chrome)
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Max-Age', '600')
}

function tokenValido(t) {
  if (!sesion || typeof t !== 'string' || t.length !== sesion.token.length) return false
  return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(sesion.token))
}

function leerCuerpo(req, limite = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const partes = []
    let total = 0
    req.on('data', (c) => {
      total += c.length
      if (total > limite) { reject(new Error('Demasiado grande')); req.destroy() }
      else partes.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')))
    req.on('error', reject)
  })
}

// La fusión la hace la ventana (que tiene la base de datos); aquí solo se reenvía
function pedirFusion(paquete) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const t = setTimeout(() => { pendientes.delete(id); reject(new Error('La PC no respondió')) }, 60000)
    pendientes.set(id, { resolve, reject, t })
    win?.webContents.send('sync:solicitud', { id, paquete })
  })
}

ipcMain.handle('sync:respuesta', (_e, { id, paquete, error }) => {
  const p = pendientes.get(id)
  if (!p) return
  clearTimeout(p.t)
  pendientes.delete(id)
  if (error) p.reject(new Error(error))
  else p.resolve(paquete)
})

// Página puente: se usa cuando el navegador del celular no permite la conexión directa.
// El celular navega aquí con sus datos en el fragmento (#), la página los envía a la PC
// y regresa a la app con los datos de la PC.
const puente = (origenes) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sincronizando…</title><style>body{font-family:system-ui,sans-serif;background:#f6f2ff;color:#43237f;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
.c{width:64px;height:64px;border:8px solid #d8c8ff;border-top-color:#7445d6;border-radius:50%;animation:g 1s linear infinite;margin:0 auto 20px}@keyframes g{to{transform:rotate(360deg)}}</style></head>
<body><div><div class="c"></div><h2>Sincronizando con la computadora…</h2><p id="m">No cierres esta pantalla.</p></div>
<script>
(async () => {
  const q = new URLSearchParams(location.hash.slice(1))
  const permitidos = ${JSON.stringify(origenes)}
  try {
    const volver = new URL(q.get('volver'))
    if (!permitidos.includes(volver.origin)) throw new Error('Dirección de regreso no permitida')
    const r = await fetch('/sync?formato=comprimido', { method: 'POST', headers: { 'X-Token': q.get('t'), 'Content-Type': 'text/plain' }, body: q.get('d') })
    if (!r.ok) throw new Error(await r.text())
    const d = await r.text()
    location.replace(volver.origin + volver.pathname + '#/sincronizar?r=' + encodeURIComponent(d))
  } catch (e) { document.getElementById('m').textContent = 'No se pudo sincronizar: ' + e.message }
})()
</script></body></html>`

async function manejar(req, res) {
  cabecerasCors(req, res)
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (req.method === 'GET' && url.pathname === '/puente') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    return res.end(puente(sesion?.origenes ?? []))
  }
  if (!tokenValido(req.headers['x-token'] || url.searchParams.get('t'))) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    return res.end('Código vencido. Vuelve a escanear el QR de la computadora.')
  }
  if (req.method === 'GET' && url.pathname === '/hola') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ app: 'evaluaciones-comunicacion', version: app.getVersion() }))
  }
  if (req.method === 'POST' && url.pathname === '/sync') {
    avisar('recibiendo', {})
    try {
      const cuerpo = await leerCuerpo(req)
      const comprimido = url.searchParams.get('formato') === 'comprimido'
      const respuesta = await pedirFusion({ cuerpo, comprimido })
      res.writeHead(200, { 'Content-Type': comprimido ? 'text/plain' : 'application/json' })
      res.end(respuesta)
      reiniciarVencimiento()
    } catch (e) {
      avisar('error', { mensaje: e.message })
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(e.message)
    }
    return
  }
  res.writeHead(404)
  res.end()
}

function reiniciarVencimiento() {
  if (!sesion) return
  clearTimeout(sesion.timer)
  sesion.vence = Date.now() + DURACION_MS
  sesion.timer = setTimeout(detenerServidor, DURACION_MS)
  avisar('vence', { vence: sesion.vence })
}

function escuchar(puerto) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => manejar(req, res).catch(() => { try { res.writeHead(500); res.end() } catch {} }))
    s.once('error', reject)
    s.listen(puerto, '0.0.0.0', () => resolve(s))
  })
}

async function iniciarServidor(origenes) {
  if (!servidor) {
    try { servidor = await escuchar(PUERTO_PREFERIDO) } catch { servidor = await escuchar(0) }
  }
  sesion = { token: crypto.randomBytes(12).toString('hex'), origenes, vence: 0, timer: null }
  reiniciarVencimiento()
  const puerto = servidor.address().port
  return { token: sesion.token, puerto, ips: ipsLocales(), vence: sesion.vence }
}

function detenerServidor() {
  if (sesion) clearTimeout(sesion.timer)
  sesion = null
  if (servidor) { servidor.close(); servidor.closeAllConnections?.() }
  servidor = null
  avisar('detenido', {})
}

ipcMain.handle('sync:iniciar', (_e, origenes) => iniciarServidor(origenes))
ipcMain.handle('sync:detener', () => detenerServidor())

/* ------------------------------------------------------------------ */
/* Ventana                                                             */
/* ------------------------------------------------------------------ */

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#F6F2FF',
    title: 'Evaluaciones de Comunicación',
    icon: path.join(__dirname, '..', 'dist', 'icon-512.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => { win = null })

  // los enlaces externos se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env.VITE_DEV_URL) win.loadURL(process.env.VITE_DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { detenerServidor(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
