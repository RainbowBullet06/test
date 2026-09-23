import confetti from 'canvas-confetti'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, FolderCheck, FolderOpen, Laptop, RotateCcw, ScanLine, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings, updateSettings } from '../db'
import { cambiarCarpeta, leerRespaldoDeCarpeta, marcarRestaurado } from '../lib/respaldo'
import { restaurar, type Paquete } from '../lib/sync'
import { Btn, Mascot, spring } from './ui'

/** Pantalla de configuración inicial. Se muestra una sola vez, al abrir la app por primera vez. */
export default function Bienvenida({ alTerminar }: { alTerminar: () => void }) {
  const navigate = useNavigate()
  const esPC = !!window.escritorio
  const [paso, setPaso] = useState(0)
  const [nombre, setNombre] = useState('')
  const [lugar, setLugar] = useState('')
  const [carpeta, setCarpeta] = useState<string | null>(null)
  const [sugerida, setSugerida] = useState('')
  const [respaldo, setRespaldo] = useState<Paquete | null>(null)
  const [restaurado, setRestaurado] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    getSettings().then((s) => { setNombre(s.especialista); setLugar(s.lugar) })
    window.escritorio?.respaldo.sugerida().then(setSugerida)
    window.escritorio?.respaldo.carpeta().then(setCarpeta)
  }, [])

  async function usarCarpeta(c: string | null) {
    if (!c) return
    setCarpeta(c)
    // ¿Ya hay un respaldo ahí? (p. ej. después de reinstalar la computadora)
    const previo = await leerRespaldoDeCarpeta().catch(() => null)
    const vacio = (await db.evaluations.count()) === 0 && (await db.students.count()) === 0
    setRespaldo(previo && vacio && (previo.evaluations?.length || previo.students?.length) ? previo : null)
    cambiarCarpeta(c)
  }

  async function restaurarRespaldo() {
    if (!respaldo) return
    setOcupado(true)
    await restaurar(respaldo)
    marcarRestaurado()
    setRestaurado(true)
    setOcupado(false)
    const s = await getSettings()
    if (s.especialista && !nombre) setNombre(s.especialista)
  }

  async function finalizar(irASincronizar = false) {
    await updateSettings({ especialista: nombre.trim(), lugar: lugar.trim(), configurado: true })
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: ['#8a63e8', '#c1a8ff', '#ffc857', '#4fd1a1', '#ff7e79'] })
    alTerminar()
    if (irASincronizar) navigate('/sincronizar')
  }

  const pasos = esPC ? ['nombre', 'carpeta', 'listo'] : ['nombre', 'celular', 'listo']
  const actual = pasos[paso]
  const puedeSeguir = actual === 'nombre' ? nombre.trim().length > 2 : actual === 'carpeta' ? !!carpeta : true

  return (
    <motion.div className="bienvenida" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bienvenida-caja" initial={{ y: 40, scale: 0.96 }} animate={{ y: 0, scale: 1 }} transition={spring}>
        <div className="bienvenida-puntos">
          {pasos.map((p, i) => <motion.span key={p} animate={{ width: i === paso ? 34 : 12, background: i <= paso ? '#7445d6' : '#d8c8ff' }} />)}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={actual} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            {actual === 'nombre' && (
              <div className="bienvenida-paso">
                <Mascot size={150} mood="wave" />
                <h1>¡Te damos la bienvenida!</h1>
                <p className="muted">Vamos a dejar todo listo en un minuto.</p>
                <div className="field" style={{ textAlign: 'left', width: '100%' }}>
                  <label htmlFor="bn"><UserRound size={18} style={{ verticalAlign: -3 }} /> ¿Cómo te llamas?</label>
                  <input id="bn" className="input" autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo (aparece en los informes)" />
                </div>
                <div className="field" style={{ textAlign: 'left', width: '100%' }}>
                  <label htmlFor="bl">¿En qué ciudad trabajas? <span className="muted small">(opcional)</span></label>
                  <input id="bl" className="input" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej. Culiacán, Sinaloa" />
                </div>
              </div>
            )}

            {actual === 'carpeta' && (
              <div className="bienvenida-paso">
                <motion.div className="card-icon" style={{ width: 96, height: 96, borderRadius: 30, background: '#dcf7ec', color: '#11704d' }}
                  initial={{ rotate: -12, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} transition={spring}>
                  {carpeta ? <FolderCheck size={50} /> : <FolderOpen size={50} />}
                </motion.div>
                <h1>¿Dónde guardamos los respaldos?</h1>
                <p className="muted">Cada evaluación y cada informe se guardan también como archivos en esta carpeta, automáticamente. Así nunca se pierden, aunque la computadora falle.</p>
                {carpeta ? (
                  <div className="carpeta-elegida"><FolderCheck size={22} /> <span>{carpeta}</span></div>
                ) : (
                  <Btn size="lg" variant="mint" block icon={<FolderCheck size={24} />} onClick={async () => usarCarpeta(await window.escritorio!.respaldo.usar(sugerida))}>
                    Usar la carpeta recomendada
                  </Btn>
                )}
                <Btn variant="ghost" icon={<FolderOpen size={22} />} onClick={async () => usarCarpeta(await window.escritorio!.respaldo.elegir())}>
                  {carpeta ? 'Cambiar carpeta' : 'Elegir otra carpeta (USB, Drive…)'}
                </Btn>
                {!carpeta && sugerida && <p className="small muted">Recomendada: {sugerida}</p>}
                <AnimatePresence>
                  {respaldo && (
                    <motion.div className="suggest" style={{ textAlign: 'left', width: '100%' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="suggest-head"><RotateCcw size={18} /> Encontramos un respaldo en esta carpeta</div>
                      <p>{respaldo.students.length} alumnos y {respaldo.evaluations.length} evaluaciones, guardado el {new Date(respaldo.generado).toLocaleString('es-MX')}.</p>
                      {restaurado
                        ? <span className="badge mint"><Check size={14} /> Datos restaurados</span>
                        : <Btn variant="sun" disabled={ocupado} icon={<RotateCcw size={20} />} onClick={restaurarRespaldo}>{ocupado ? 'Restaurando…' : 'Restaurar mis datos'}</Btn>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {actual === 'celular' && (
              <div className="bienvenida-paso">
                <motion.div className="card-icon" style={{ width: 96, height: 96, borderRadius: 30, background: '#e3f4ff', color: '#1d6fa8' }}
                  initial={{ rotate: 12, scale: 0.7 }} animate={{ rotate: 0, scale: 1 }} transition={spring}>
                  <Laptop size={50} />
                </motion.div>
                <h1>¿Usas la app en tu computadora?</h1>
                <p className="muted">
                  Tus evaluaciones se guardan en este celular y funcionan sin internet. En casa, conéctalo con la computadora
                  para pasarlas y que queden respaldadas en archivos.
                </p>
                <Btn size="lg" variant="sun" block icon={<ScanLine size={24} />} onClick={() => finalizar(true)}>Conectar con mi computadora ahora</Btn>
              </div>
            )}

            {actual === 'listo' && (
              <div className="bienvenida-paso">
                <Mascot size={160} mood="cheer" />
                <h1>¡Todo listo{nombre ? `, ${nombre.split(' ')[0]}` : ''}!</h1>
                <p className="muted">Ya puedes registrar escuelas, alumnos y aplicar evaluaciones.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="row" style={{ marginTop: 26 }}>
          {paso > 0 && <Btn variant="ghost" icon={<ArrowLeft size={22} />} onClick={() => setPaso(paso - 1)}>Atrás</Btn>}
          <div className="spacer" />
          {actual === 'listo' ? (
            <Btn size="lg" variant="sun" icon={<Check size={24} />} onClick={() => finalizar()}>Empezar</Btn>
          ) : (
            <Btn size="lg" disabled={!puedeSeguir} onClick={() => setPaso(paso + 1)}>
              {actual === 'celular' ? 'Ahora no' : 'Siguiente'} <ArrowRight size={22} />
            </Btn>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
