import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ArrowRight, ClipboardCheck, ClipboardPen, FileText, FolderCheck, FolderOpen, GraduationCap, RefreshCcw, RotateCcw, School, Smartphone, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Btn, Card, CardTitle, CountUp, Mascot, Squiggle, Star, avatarColor, iniciales, riseItem, stagger } from '../components/ui'
import { db } from '../db'
import { leerRespaldoDeCarpeta, marcarRestaurado, useRespaldo } from '../lib/respaldo'
import { restaurar } from '../lib/sync'
import { hace } from './Sincronizar'
import { EstadoBadge } from './StudentDetail'

function saludo() {
  const h = new Date().getHours()
  return h < 12 ? '¡Buenos días!' : h < 19 ? '¡Buenas tardes!' : '¡Buenas noches!'
}

export default function Home() {
  const navigate = useNavigate()
  const data = useLiveQuery(async () => {
    const [escuelas, alumnos, evals, settings] = await Promise.all([
      db.schools.count(),
      db.students.toArray(),
      db.evaluations.orderBy('updatedAt').reverse().toArray(),
      db.settings.get('main'),
    ])
    return { escuelas, alumnos, evals, settings }
  })
  const alumnosById = new Map(data?.alumnos.map((a) => [a.id!, a]))
  const enProceso = data?.evals.filter((e) => e.estado !== 'terminada').length ?? 0
  const terminadas = data?.evals.filter((e) => e.estado === 'terminada').length ?? 0
  const nombre = data?.settings?.especialista?.split(' ')[0]

  const tiles = [
    { to: '/evaluar', title: 'Nueva evaluación', desc: 'Aplica la prueba paso a paso', icon: ClipboardPen, bg: 'linear-gradient(145deg,#9b78ff,#6a3fd0)', edge: '#4d2a9e' },
    { to: '/alumnos', title: 'Alumnos', desc: 'Registra y consulta alumnos', icon: GraduationCap, bg: 'linear-gradient(145deg,#ff9a8f,#f06a63)', edge: '#c9463f' },
    { to: '/escuelas', title: 'Escuelas', desc: 'Da de alta tus escuelas', icon: School, bg: 'linear-gradient(145deg,#6ed8b0,#2fb888)', edge: '#1f8e67' },
  ]

  return (
    <>
      <motion.div className="hero" initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
        <Star size={30} style={{ position: 'absolute', top: 22, right: '38%' }} />
        <Star size={18} color="#b8ecff" style={{ position: 'absolute', bottom: 26, right: 200 }} />
        <div style={{ position: 'relative' }}>
          <div className="eyebrow" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><Sparkles size={16} /> {saludo()}</div>
          <h1>{nombre ? `Hola, ${nombre}` : '¡Hola!'}</h1>
          <Squiggle width={150} color="#ffc857" />
          <p>¿A quién evaluamos hoy? Registra la prueba paso a paso y descarga el informe listo en Word.</p>
          <Btn variant="sun" size="lg" icon={<ClipboardPen size={24} />} onClick={() => navigate('/evaluar')}>Comenzar evaluación</Btn>
        </div>
        <div className="hero-mascot"><Mascot size={190} mood="wave" /></div>
      </motion.div>

      <motion.div className="grid grid-3" style={{ marginTop: 24 }} variants={stagger} initial="hidden" animate="show">
        {tiles.map((t) => (
          <motion.div key={t.to} variants={riseItem}>
            <Link to={t.to} style={{ textDecoration: 'none' }}>
              <motion.div className="action-tile" style={{ background: t.bg, boxShadow: `0 8px 0 ${t.edge}, 0 24px 40px -20px ${t.edge}` }}
                whileHover={{ y: -6, rotate: -0.6 }} whileTap={{ y: 6, boxShadow: `0 2px 0 ${t.edge}` }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
                <span className="tile-icon"><t.icon size={32} strokeWidth={2.2} /></span>
                <span className="tile-arrow"><ArrowRight size={22} /></span>
                <t.icon className="tile-deco" size={150} strokeWidth={1.4} />
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginTop: 24 }}>
        {[
          { n: data?.escuelas ?? 0, l: 'Escuelas', c: '#dcf7ec', f: '#11704d', i: School },
          { n: data?.alumnos.length ?? 0, l: 'Alumnos', c: '#ffe5e3', f: '#b0302b', i: GraduationCap },
          { n: enProceso, l: 'En proceso', c: '#fff2cf', f: '#8a5a00', i: ClipboardPen },
          { n: terminadas, l: 'Informes listos', c: 'var(--lav-100)', f: 'var(--lav-700)', i: ClipboardCheck },
        ].map((s, i) => (
          <Card key={s.l} delay={0.15 + i * 0.05} style={{ padding: 20 }}>
            <div className="stat">
              <span className="card-icon" style={{ background: s.c, color: s.f }}><s.i size={24} /></span>
              <div>
                <div className="stat-num"><CountUp value={s.n} /></div>
                <div className="stat-label">{s.l}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <EstadoDatos ultimaSync={data?.settings?.ultimaSync} />

      <Card delay={0.25} style={{ marginTop: 24 }}>
        <CardTitle icon={<FileText size={24} />} sub="Continúa donde te quedaste.">Evaluaciones recientes</CardTitle>
        {data && data.evals.length === 0 ? (
          <div className="empty">
            <Mascot size={110} mood="think" />
            <h3>Aún no hay evaluaciones</h3>
            <p>Cuando apliques tu primera prueba aparecerá aquí.</p>
          </div>
        ) : (
          <motion.div className="list" variants={stagger} initial="hidden" animate="show">
            {data?.evals.slice(0, 6).map((e) => {
              const a = alumnosById.get(e.studentId)
              return (
                <motion.div key={e.id} variants={riseItem}>
                  <Link to={e.estado === 'terminada' ? `/evaluacion/${e.id}/informe` : `/evaluacion/${e.id}`} className="list-item clickable">
                    <span className="avatar" style={{ background: avatarColor(a?.nombre ?? e.studentId) }}>{iniciales(a?.nombre ?? '?')}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="li-title">{a?.nombre ?? 'Alumno eliminado'}</div>
                      <div className="li-sub">{new Date(e.updatedAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    </div>
                    <EstadoBadge estado={e.estado} />
                    <ArrowRight size={20} color="var(--lav-400)" />
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </Card>
    </>
  )
}

/** Tranquilidad para la maestra: dónde están respaldados sus datos. */
function EstadoDatos({ ultimaSync }: { ultimaSync?: number }) {
  const navigate = useNavigate()
  const respaldo = useRespaldo()

  if (window.escritorio && respaldo.restaurable) {
    const r = respaldo.restaurable
    return (
      <Card delay={0.2} style={{ marginTop: 24 }} className="aviso-card">
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <span className="card-icon" style={{ background: '#fff2cf', color: '#8a5a00' }}><RotateCcw size={24} /></span>
          <div style={{ flex: '1 1 260px' }}>
            <strong>Encontramos tus datos en la carpeta de respaldo</strong>
            <div className="small muted">{r.alumnos} alumnos y {r.evaluaciones} evaluaciones guardados el {new Date(r.fecha).toLocaleString('es-MX')}.</div>
          </div>
          <Btn variant="sun" icon={<RotateCcw size={20} />} onClick={async () => {
            const p = await leerRespaldoDeCarpeta()
            if (p) { await restaurar(p); marcarRestaurado() }
          }}>Restaurar mis datos</Btn>
        </div>
      </Card>
    )
  }

  if (window.escritorio) {
    return (
      <Card delay={0.2} style={{ marginTop: 24 }}>
        <div className="row" style={{ alignItems: 'center', gap: 16 }}>
          <span className="card-icon" style={{ background: '#dcf7ec', color: '#11704d' }}><FolderCheck size={24} /></span>
          <div style={{ flex: '1 1 260px' }}>
            <strong>Tus evaluaciones se respaldan solas en archivos</strong>
            <div className="small muted">{respaldo.carpeta ?? 'Sin carpeta'} · último respaldo {hace(respaldo.ultimo ?? undefined)}</div>
          </div>
          <Btn size="sm" variant="ghost" icon={<FolderOpen size={20} />} onClick={() => window.escritorio!.respaldo.abrir()}>Abrir carpeta</Btn>
          <Btn size="sm" variant="ghost" icon={<Smartphone size={20} />} onClick={() => navigate('/sincronizar')}>Celular</Btn>
        </div>
      </Card>
    )
  }

  const dias = ultimaSync ? (Date.now() - ultimaSync) / 86400000 : Infinity
  return (
    <Card delay={0.2} style={{ marginTop: 24 }}>
      <div className="row" style={{ alignItems: 'center', gap: 16 }}>
        <span className="card-icon" style={{ background: dias > 7 ? '#fff2cf' : '#dcf7ec', color: dias > 7 ? '#8a5a00' : '#11704d' }}><RefreshCcw size={24} /></span>
        <div style={{ flex: '1 1 220px' }}>
          <strong>{dias > 7 ? 'Conecta con tu computadora para respaldar' : 'Datos respaldados en tu computadora'}</strong>
          <div className="small muted">Última sincronización: {hace(ultimaSync)}</div>
        </div>
        <Btn size="sm" variant={dias > 7 ? 'sun' : 'ghost'} icon={<RefreshCcw size={20} />} onClick={() => navigate('/sincronizar')}>Sincronizar</Btn>
      </div>
    </Card>
  )
}
