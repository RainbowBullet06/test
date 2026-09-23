import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { ClipboardPen, Plus, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Mascot, PageHead, avatarColor, iniciales, riseItem, stagger } from '../components/ui'
import { crearEvaluacion, db, edadDeAlumno, type Student } from '../db'
import { StudentForm } from './Students'

export default function NewEvaluation() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [nuevo, setNuevo] = useState<Student | null>(null)
  const schools = useLiveQuery(() => db.schools.toArray())
  const students = useLiveQuery(() => db.students.orderBy('nombre').toArray())
  const schoolById = new Map(schools?.map((s) => [s.id!, s]))
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const lista = students?.filter((s) => norm(s.nombre).includes(norm(q)))

  async function empezar(s: Student) {
    navigate(`/evaluacion/${await crearEvaluacion(s)}`)
  }

  return (
    <>
      <PageHead eyebrow={<><Sparkles size={16} /> Nueva evaluación</>} title="¿A quién vamos a evaluar?" sub="Elige al alumno. Todo se guarda solo mientras avanzas." />

      {schools && schools.length === 0 ? (
        <div className="card empty">
          <Mascot size={130} mood="think" />
          <h3>Primero registra una escuela</h3>
          <Btn size="lg" variant="sun" icon={<Plus size={24} />} onClick={() => navigate('/escuelas')}>Ir a escuelas</Btn>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 18 }}>
            <div className="search">
              <Search size={22} />
              <input className="input" autoFocus placeholder="Buscar alumno..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Btn variant="mint" size="lg" icon={<Plus size={24} />}
              onClick={() => setNuevo({ nombre: q, sexo: 'F', grado: '', schoolId: schools?.[0]?.id ?? 0, createdAt: Date.now() })}>
              Alumno nuevo
            </Btn>
          </div>
          <motion.div className="grid grid-3" variants={stagger} initial="hidden" animate="show">
            {lista?.map((s) => (
              <motion.button key={s.id} variants={riseItem} className="list-item clickable" style={{ border: 0, textAlign: 'left', width: '100%' }}
                whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }} onClick={() => empezar(s)}>
                <span className="avatar" style={{ background: avatarColor(s.nombre) }}>{iniciales(s.nombre)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="li-title">{s.nombre}</div>
                  <div className="li-sub">{[s.grado, edadDeAlumno(s), schoolById.get(s.schoolId)?.nombre].filter(Boolean).join(' · ')}</div>
                </div>
                <ClipboardPen size={22} color="var(--lav-500)" />
              </motion.button>
            ))}
          </motion.div>
          {lista && lista.length === 0 && (
            <div className="card empty">
              <Mascot size={110} mood="wave" />
              <h3>{q ? 'No hay alumnos con ese nombre' : 'Aún no hay alumnos'}</h3>
              <p>Agrégalo con el botón "Alumno nuevo".</p>
            </div>
          )}
        </>
      )}

      <StudentForm value={nuevo} onClose={() => setNuevo(null)}
        onSaved={async (id) => { setNuevo(null); const s = await db.students.get(id); if (s) empezar(s) }} />
    </>
  )
}
