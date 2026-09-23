import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ClipboardPen, FolderCheck, GraduationCap, House, RefreshCcw, School, Settings as Gear, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Actualizacion from './components/Actualizacion'
import Bienvenida from './components/Bienvenida'
import { Backdrop, Btn, Mascot, softSpring, useToast } from './components/ui'
import { db } from './db'
import { iniciarRespaldoAutomatico, useRespaldo } from './lib/respaldo'
import { atenderSolicitudesDelCelular } from './lib/sync'
import Home from './pages/Home'
import NewEvaluation from './pages/NewEvaluation'
import Report from './pages/Report'
import Schools from './pages/Schools'
import Settings from './pages/Settings'
import StudentDetail from './pages/StudentDetail'
import Students from './pages/Students'
import Sincronizar, { hace } from './pages/Sincronizar'
import Wizard from './pages/Wizard'

const esPC = !!window.escritorio
const esWeb = location.protocol.startsWith('http')

const NAV = [
  { to: '/', label: 'Inicio', icon: House, end: true },
  { to: '/escuelas', label: 'Escuelas', icon: School },
  { to: '/alumnos', label: 'Alumnos', icon: GraduationCap },
  { to: '/sincronizar', label: esPC ? 'Celular' : 'Sincronizar', icon: esPC ? Smartphone : RefreshCcw },
  { to: '/ajustes', label: 'Ajustes', icon: Gear },
]
// en el celular, "Escuelas" se abre desde Inicio y Alumnos
const TABS = [NAV[0], NAV[2], NAV[3], NAV[4]]

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const respaldo = useRespaldo()
  const cfg = useLiveQuery(() => db.settings.get('main').then((s) => s ?? null))
  const [bienvenidaCerrada, setBienvenidaCerrada] = useState(false)
  const section = '/' + (location.pathname.split('/')[1] ?? '')
  const isActive = (to: string, end?: boolean) => (end ? location.pathname === to : section === to)

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  // Solo en la computadora: respaldo automático en archivos y atención al celular
  useEffect(() => {
    iniciarRespaldoAutomatico()
    return atenderSolicitudesDelCelular((r, equipo) => {
      toast(`${equipo} sincronizado`)
      window.dispatchEvent(new CustomEvent('sincronizado', { detail: { r, equipo } }))
    })
  }, [toast])

  // Al llegar por el QR de la PC no se interrumpe con la bienvenida
  const mostrarBienvenida = cfg !== undefined && !cfg?.configurado && !bienvenidaCerrada && section !== '/sincronizar'

  return (
    <div className="shell">
      <Backdrop />

      {/* Barra lateral (PC / tableta) */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo"><Mascot size={44} /></div>
          <div>
            <div className="brand-name">Evaluaciones de Comunicación</div>
            <div className="brand-sub">USAER · CAM</div>
          </div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={() => `nav-item ${isActive(n.to, n.end) ? 'active' : ''}`}>
            {isActive(n.to, n.end) && <motion.span layoutId="nav-bg" className="nav-bg" transition={softSpring} />}
            <span className="nav-icon"><n.icon size={22} strokeWidth={2.4} /></span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="sidebar-cta">
          <Btn variant="sun" block size="lg" icon={<ClipboardPen size={24} />} onClick={() => navigate('/evaluar')}>
            Evaluar
          </Btn>
        </div>
        <div className="sidebar-foot">
          <Mascot size={88} mood="wave" />
          {esPC ? (
            <p className="estado-respaldo">
              {respaldo.error ? <><AlertTriangle size={14} /> Respaldo pendiente</> : <><FolderCheck size={14} /> Respaldo {respaldo.ultimo ? hace(respaldo.ultimo) : 'activo'}</>}
            </p>
          ) : (
            <p className="estado-respaldo"><RefreshCcw size={14} /> Sincronizado {hace(cfg?.ultimaSync)}</p>
          )}
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="topbar">
        <div className="brand-logo"><Mascot size={36} /></div>
        <div className="topbar-title">Evaluaciones de Comunicación</div>
      </header>

      <main className="main">
        <AnimatePresence>
          {esPC && respaldo.error && cfg?.configurado && (
            <motion.div className="aviso-respaldo" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <AlertTriangle size={22} />
              <span>{respaldo.error}</span>
              <Btn size="sm" variant="sun" onClick={() => navigate('/ajustes')}>Revisar</Btn>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className="page"
            initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(4px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/escuelas" element={<Schools />} />
              <Route path="/alumnos" element={<Students />} />
              <Route path="/alumnos/:id" element={<StudentDetail />} />
              <Route path="/evaluar" element={<NewEvaluation />} />
              <Route path="/evaluacion/:id" element={<Wizard />} />
              <Route path="/evaluacion/:id/informe" element={<Report />} />
              <Route path="/sincronizar" element={<Sincronizar />} />
              <Route path="/ajustes" element={<Settings />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Barra inferior (celular) */}
      <nav className="bottombar">
        {TABS.slice(0, 2).map((n) => <Tab key={n.to} {...n} active={isActive(n.to, n.end)} />)}
        <motion.button className="tab-fab" whileTap={{ scale: 0.9, y: 4 }} onClick={() => navigate('/evaluar')} aria-label="Nueva evaluación">
          <ClipboardPen size={30} strokeWidth={2.4} />
        </motion.button>
        {TABS.slice(2).map((n) => <Tab key={n.to} {...n} active={isActive(n.to, n.end)} />)}
      </nav>

      <AnimatePresence>{mostrarBienvenida && <Bienvenida alTerminar={() => setBienvenidaCerrada(true)} />}</AnimatePresence>
      {esWeb && !esPC && <Actualizacion />}
    </div>
  )
}

function Tab({ to, label, icon: Icon, active, end }: (typeof NAV)[number] & { active: boolean }) {
  return (
    <NavLink to={to} end={end} className={`tab ${active ? 'active' : ''}`}>
      {active && <motion.span layoutId="tab-dot" className="tab-dot" transition={softSpring} />}
      <Icon size={24} strokeWidth={2.4} />
      <span>{label}</span>
    </NavLink>
  )
}
