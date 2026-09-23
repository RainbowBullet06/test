import confetti from 'canvas-confetti'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2, Download, FileUp, House, Laptop, Loader2, Power, QrCode, RefreshCw, ScanLine, Share2, Smartphone, Wifi, WifiOff,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { EscanerQR, QR } from '../components/qr'
import { Btn, Card, CardTitle, Mascot, Modal, PageHead, useToast } from '../components/ui'
import { db, updateSettings } from '../db'
import { descargar } from '../lib/docx'
import {
  crearPaquete, direccionApp, enlaceSincronizar, fusionar, leerCodigoQR, recibirDePuente, sincronizarConPuente, sincronizarDirecto,
  type DestinoPC, type Resultado,
} from '../lib/sync'

export function hace(ms?: number) {
  if (!ms) return 'nunca'
  const min = Math.round((Date.now() - ms) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : `hace ${d} días`
}

function resumen(r: Resultado) {
  const partes = [
    r.nuevos && `${r.nuevos} nuevo${r.nuevos > 1 ? 's' : ''}`,
    r.actualizados && `${r.actualizados} actualizado${r.actualizados > 1 ? 's' : ''}`,
    r.eliminados && `${r.eliminados} eliminado${r.eliminados > 1 ? 's' : ''}`,
  ].filter(Boolean)
  return partes.length ? partes.join(', ') : 'Todo estaba al día'
}

const festejar = () => confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#8a63e8', '#c1a8ff', '#ffc857', '#4fd1a1'] })

export default function Sincronizar() {
  return window.escritorio ? <ModoComputadora /> : <ModoCelular />
}

/* ================================================================== */
/* En la computadora: encender el servidor bajo demanda y mostrar QR  */
/* ================================================================== */

interface Sesion { token: string; puerto: number; ips: string[]; vence: number }

function ModoComputadora() {
  const toast = useToast()
  const cfg = useLiveQuery(() => db.settings.get('main'))
  const appUrl = direccionApp(cfg?.appUrl)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [ip, setIp] = useState(0)
  const [estado, setEstado] = useState<'esperando' | 'recibiendo' | 'listo'>('esperando')
  const [ultimo, setUltimo] = useState<{ r: Resultado; equipo: string } | null>(null)
  const [ahora, setAhora] = useState(Date.now())

  useEffect(() => {
    const esc = window.escritorio!
    const quitar = esc.sync.alEvento((d) => {
      if (d.evento === 'recibiendo') setEstado('recibiendo')
      if (d.evento === 'vence' && d.vence) setSesion((s) => (s ? { ...s, vence: d.vence! } : s))
      if (d.evento === 'detenido') setSesion(null)
      if (d.evento === 'error') { setEstado('esperando'); toast(d.mensaje ?? 'Error al sincronizar', 'error') }
    })
    const alListo = (e: Event) => {
      const { r, equipo } = (e as CustomEvent).detail
      setUltimo({ r, equipo })
      setEstado('listo')
      festejar()
    }
    window.addEventListener('sincronizado', alListo)
    return () => { quitar(); window.removeEventListener('sincronizado', alListo) }
  }, [toast])

  useEffect(() => {
    if (!sesion) return
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sesion])

  async function conectar() {
    const origen = new URL(appUrl).origin
    const s = await window.escritorio!.sync.iniciar([origen])
    if (!s.ips.length) {
      await window.escritorio!.sync.detener()
      toast('La computadora no está conectada a ninguna red Wi-Fi', 'error')
      return
    }
    setIp(0)
    setEstado('esperando')
    setUltimo(null)
    setSesion(s)
  }

  const restante = sesion ? Math.max(0, sesion.vence - ahora) : 0
  const enlace = sesion ? enlaceSincronizar(appUrl, `http://${sesion.ips[ip]}:${sesion.puerto}`, sesion.token) : ''

  return (
    <>
      <PageHead eyebrow={<><Smartphone size={16} /> Celular</>} title="Conectar con el celular"
        sub="Pasa las evaluaciones del celular a la computadora (y al revés) estando en casa." />

      {!appUrl && (
        <Card>
          <CardTitle icon={<WifiOff size={24} />} color="#ffe5e3" fg="#b0302b"
            sub="Falta la dirección de la app para celulares. Escríbela en Ajustes → App para celulares.">
            Falta un paso de instalación
          </CardTitle>
        </Card>
      )}

      {appUrl && (
        <Card>
          <AnimatePresence initial={false}>
            {!sesion ? (
              <motion.div key="off" className="row" style={{ gap: 24, alignItems: 'center' }}>
                <Mascot size={130} mood="wave" />
                <div style={{ flex: '1 1 300px' }}>
                  <h2 style={{ fontSize: '1.6rem', color: 'var(--lav-800)' }}>Sincronizar evaluaciones</h2>
                  <p className="muted" style={{ margin: '8px 0 18px' }}>
                    Úsalo <strong>solo en casa</strong>, con la computadora y el celular en el mismo Wi-Fi.
                    La conexión se apaga sola a los 15 minutos.
                  </p>
                  <Btn size="lg" variant="sun" icon={<House size={24} />} onClick={conectar}>Conectar celular (solo en casa)</Btn>
                  {cfg?.ultimaSync && <p className="small muted" style={{ marginTop: 12 }}>Última sincronización: {hace(cfg.ultimaSync)}</p>}
                </div>
              </motion.div>
            ) : (
              <motion.div key="on" className="sync-activo" initial={{ scale: 0.97 }} animate={{ scale: 1 }}>
                <div className="sync-qr">
                  <QR texto={enlace} tam={250} />
                  <span className="badge mint"><Wifi size={14} /> Conexión activa · {Math.floor(restante / 60000)}:{String(Math.floor((restante % 60000) / 1000)).padStart(2, '0')}</span>
                </div>
                <div style={{ flex: '1 1 280px' }}>
                  <ol className="pasos">
                    <li><strong>Abre la cámara</strong> del celular y apunta a este código.</li>
                    <li>Toca el aviso que aparece para <strong>abrir la app</strong>.</li>
                    <li>Si el celular pregunta por la <strong>red local</strong>, toca <strong>Permitir</strong>.</li>
                  </ol>
                  <p className="small muted">¿Ya tienes la app abierta? Toca <em>Escanear código de la computadora</em> en el celular.</p>
                  <EstadoSync estado={estado} ultimo={ultimo} />
                  <div className="row" style={{ marginTop: 16 }}>
                    <Btn variant="coral" icon={<Power size={22} />} onClick={() => window.escritorio!.sync.detener()}>Desconectar</Btn>
                    {sesion.ips.length > 1 && (
                      <Btn variant="ghost" icon={<RefreshCw size={20} />} onClick={() => setIp((i) => (i + 1) % sesion.ips.length)}>
                        ¿No conecta? Probar otra red
                      </Btn>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {appUrl && (
        <Card delay={0.05}>
          <div className="row" style={{ gap: 24, alignItems: 'center' }}>
            <QR texto={appUrl} tam={150} />
            <div style={{ flex: '1 1 280px' }}>
              <CardTitle icon={<Smartphone size={24} />} color="#e3f4ff" fg="#1d6fa8">Instalar la app en el celular</CardTitle>
              <ol className="pasos">
                <li>Escanea este código con la cámara del celular.</li>
                <li><strong>Android:</strong> toca "Instalar" (o menú ⋮ → Instalar aplicación).</li>
                <li><strong>iPhone:</strong> botón Compartir → "Agregar a pantalla de inicio".</li>
              </ol>
              <p className="small muted" style={{ margin: 0 }}>Solo se hace una vez. La app se actualiza sola y funciona sin internet en el aula.</p>
            </div>
          </div>
        </Card>
      )}

      <ConArchivo />
    </>
  )
}

function EstadoSync({ estado, ultimo }: { estado: 'esperando' | 'recibiendo' | 'listo'; ultimo: { r: Resultado; equipo: string } | null }) {
  return (
    <AnimatePresence initial={false}>
      <motion.div key={estado} className={`sync-estado ${estado}`} initial={{ y: 8 }} animate={{ y: 0 }}>
        {estado === 'esperando' && <><Loader2 className="girar" size={22} /> Esperando al celular…</>}
        {estado === 'recibiendo' && <><Loader2 className="girar" size={22} /> Sincronizando…</>}
        {estado === 'listo' && ultimo && <><CheckCircle2 size={22} /> ¡Listo! {ultimo.equipo}: {resumen(ultimo.r)}</>}
      </motion.div>
    </AnimatePresence>
  )
}

/* ================================================================== */
/* En el celular: escanear y conectarse a la computadora              */
/* ================================================================== */

interface InstallEvent extends Event { prompt: () => Promise<void> }

function ModoCelular() {
  const location = useLocation()
  const navigate = useNavigate()
  const cfg = useLiveQuery(() => db.settings.get('main'))
  const [escaneando, setEscaneando] = useState(false)
  const [fase, setFase] = useState<'inicio' | 'conectando' | 'puente' | 'listo' | 'error'>('inicio')
  const [mensaje, setMensaje] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [instalar, setInstalar] = useState<InstallEvent | null>(null)
  const procesado = useRef('')

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstalar(e as InstallEvent) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  const terminar = useCallback(async (r: Resultado) => {
    setResultado(r)
    setFase('listo')
    const c = await db.settings.get('main')
    if (c?.especialista) await updateSettings({ configurado: true })
    festejar()
  }, [])

  const conectar = useCallback(async (d: DestinoPC) => {
    setEscaneando(false)
    setFase('conectando')
    try {
      const r = await sincronizarDirecto(d)
      if (r) return terminar(r)
      setFase('puente')
      await sincronizarConPuente(d) // sale de la app y regresa con los datos
    } catch (e) {
      setMensaje((e as Error).message)
      setFase('error')
    }
  }, [terminar])

  // Llegada desde el QR (?pc=&t=) o de regreso del puente (?r=)
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    const clave = location.search
    if (!clave || procesado.current === clave) return
    procesado.current = clave
    const r = q.get('r')
    const pc = q.get('pc')
    const t = q.get('t')
    navigate('/sincronizar', { replace: true })
    if (r) {
      setFase('conectando')
      recibirDePuente(r).then(terminar).catch((e) => { setMensaje((e as Error).message); setFase('error') })
    } else if (pc && t) {
      conectar({ pc, t })
    }
  }, [location.search, navigate, conectar, terminar])

  const leido = useCallback((texto: string) => {
    const d = leerCodigoQR(texto)
    if (d) conectar(d)
    else { setEscaneando(false); setMensaje('Ese código no es de la computadora. Busca el código en la pantalla "Celular" de la PC.'); setFase('error') }
  }, [conectar])
  const errorCamara = useCallback((m: string) => { setEscaneando(false); setMensaje(m); setFase('error') }, [])

  const enApp = window.matchMedia('(display-mode: standalone)').matches

  return (
    <>
      <PageHead eyebrow={<><Laptop size={16} /> Computadora</>} title="Sincronizar con la computadora"
        sub="En casa, con el mismo Wi-Fi: tus evaluaciones pasan a la computadora y se respaldan." />

      {!enApp && instalar && (
        <Card>
          <div className="row" style={{ alignItems: 'center', gap: 16 }}>
            <Smartphone size={34} color="var(--lav-600)" />
            <div style={{ flex: '1 1 200px' }}><strong>Instala la app en este celular</strong><div className="small muted">Así funciona sin internet en el aula.</div></div>
            <Btn variant="sun" onClick={async () => { await instalar.prompt(); setInstalar(null) }}>Instalar</Btn>
          </div>
        </Card>
      )}

      <Card>
        <AnimatePresence initial={false}>
          <motion.div key={fase} className="sync-celular" initial={{ y: 12 }} animate={{ y: 0 }}>
            {fase === 'inicio' && (
              <>
                <Mascot size={130} mood="wave" />
                <p className="muted" style={{ maxWidth: 420 }}>
                  En la computadora abre <strong>Celular</strong> y presiona <strong>Conectar celular</strong>. Luego escanea el código.
                </p>
                <Btn size="lg" block icon={<ScanLine size={26} />} onClick={() => setEscaneando(true)}>Escanear código de la computadora</Btn>
                <p className="small muted">Última sincronización: {hace(cfg?.ultimaSync)}</p>
              </>
            )}
            {(fase === 'conectando' || fase === 'puente') && (
              <>
                <Mascot size={130} mood="think" />
                <h2>{fase === 'puente' ? 'Conectando por otro camino…' : 'Conectando con la computadora…'}</h2>
                <p className="muted">Si aparece un aviso sobre la <strong>red local</strong>, toca <strong>Permitir</strong>.</p>
                <Loader2 className="girar" size={40} color="var(--lav-500)" />
              </>
            )}
            {fase === 'listo' && resultado && (
              <>
                <Mascot size={140} mood="cheer" />
                <h2>¡Listo!</h2>
                <p className="muted">{resumen(resultado)}. Tus datos ya están en la computadora y en este celular.</p>
                <Btn size="lg" variant="mint" onClick={() => navigate('/')}>Terminar</Btn>
              </>
            )}
            {fase === 'error' && (
              <>
                <Mascot size={120} mood="think" />
                <h2>No se pudo conectar</h2>
                <p className="muted">{mensaje}</p>
                <p className="small muted">Revisa que ambos estén en el <strong>mismo Wi-Fi</strong> y que la computadora muestre el código.</p>
                <Btn size="lg" icon={<QrCode size={24} />} onClick={() => { setFase('inicio'); setEscaneando(true) }}>Intentar de nuevo</Btn>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      <ConArchivo />

      <Modal open={escaneando} onClose={() => setEscaneando(false)} title="Apunta al código"
        icon={<span className="card-icon" style={{ background: 'var(--lav-100)', color: 'var(--lav-600)' }}><ScanLine size={24} /></span>}>
        {escaneando && <EscanerQR alLeer={leido} alError={errorCamara} />}
      </Modal>
    </>
  )
}

/* ================================================================== */
/* Alternativa sin red: pasar los datos en un archivo                 */
/* ================================================================== */

function ConArchivo() {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)

  async function enviar() {
    const nombre = `evaluaciones-${window.escritorio ? 'computadora' : 'celular'}-${new Date().toLocaleDateString('en-CA')}.json`
    const archivo = new File([JSON.stringify(await crearPaquete())], nombre, { type: 'application/json' })
    if (!window.escritorio && navigator.canShare?.({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: 'Evaluaciones' })
        return
      } catch {
        /* cancelado: se descarga */
      }
    }
    descargar(archivo, nombre)
    toast('Archivo guardado en Descargas')
  }

  async function recibir(f: File) {
    try {
      const r = await fusionar(JSON.parse(await f.text()))
      toast(`Datos recibidos: ${resumen(r)}`)
      festejar()
    } catch (e) {
      toast((e as Error).message || 'Archivo inválido', 'error')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Card delay={0.1}>
      <CardTitle icon={<Share2 size={24} />} color="#dcf7ec" fg="#11704d"
        sub="Si no hay Wi-Fi: envía el archivo por WhatsApp, correo o Quick Share y ábrelo en el otro equipo. Los datos se juntan, no se reemplazan.">
        Pasar datos con un archivo
      </CardTitle>
      <div className="row">
        <Btn variant="mint" icon={<Download size={22} />} onClick={enviar}>{window.escritorio ? 'Guardar archivo' : 'Enviar archivo'}</Btn>
        <Btn variant="ghost" icon={<FileUp size={22} />} onClick={() => input.current?.click()}>Recibir archivo</Btn>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && recibir(e.target.files[0])} />
      </div>
    </Card>
  )
}
