import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, ClipboardPen, FileText, Pencil, School, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Btn, Card, CardTitle, Mascot, avatarColor, iniciales, riseItem, stagger, useConfirm, useToast } from '../components/ui'
import { borrarAlumno, borrarEvaluacion, crearEvaluacion, db, edadDeAlumno, type Evaluation, type Student } from '../db'
import { progresoPrueba } from '../lib/analisis'
import { fechaLarga } from '../lib/docx'
import { StudentForm } from './Students'

export function EstadoBadge({ estado }: { estado: Evaluation['estado'] }) {
  if (estado === 'terminada') return <span className="badge mint">Informe listo</span>
  if (estado === 'prueba-lista') return <span className="badge lav">Falta informe</span>
  return <span className="badge sun">En proceso</span>
}

export default function StudentDetail() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [edit, setEdit] = useState<Student | null>(null)
  const alumno = useLiveQuery(() => db.students.get(id), [id])
  const escuela = useLiveQuery(() => (alumno ? db.schools.get(alumno.schoolId) : undefined), [alumno?.schoolId])
  const evals = useLiveQuery(() => db.evaluations.where('studentId').equals(id).reverse().sortBy('updatedAt'), [id])

  if (alumno === undefined) return null
  if (!alumno) return <div className="card empty"><Mascot mood="think" /><h3>No encontré a este alumno</h3></div>

  async function nueva() {
    const evId = await crearEvaluacion(alumno!)
    navigate(`/evaluacion/${evId}`)
  }

  async function eliminarAlumno() {
    if (!(await confirm(`Se eliminará a ${alumno!.nombre} y todas sus evaluaciones.`))) return
    await borrarAlumno(id)
    toast('Alumno eliminado')
    navigate('/alumnos')
  }

  async function borrarEval(e: Evaluation) {
    if (!(await confirm('Se eliminará esta evaluación y su informe.'))) return
    await borrarEvaluacion(e.id!)
    toast('Evaluación eliminada')
  }

  return (
    <>
      <Btn variant="ghost" size="sm" icon={<ArrowLeft size={20} />} onClick={() => navigate('/alumnos')} style={{ marginBottom: 18 }}>Alumnos</Btn>

      <Card>
        <div className="row" style={{ alignItems: 'center', gap: 20 }}>
          <motion.span className="avatar" style={{ background: avatarColor(alumno.nombre), width: 88, height: 88, borderRadius: 28, fontSize: '2rem' }}
            initial={{ rotate: -20, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
            {iniciales(alumno.nombre)}
          </motion.span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', color: 'var(--lav-800)' }}>{alumno.nombre}</h1>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="badge lav"><UserRound size={14} /> {alumno.sexo === 'F' ? 'Niña' : 'Niño'}</span>
              {edadDeAlumno(alumno) && <span className="badge sun">{edadDeAlumno(alumno)}</span>}
              {alumno.grado && <span className="badge mint">{alumno.grado} {alumno.grupo}</span>}
              {escuela && <span className="badge coral"><School size={14} /> {escuela.nombre}</span>}
            </div>
            {alumno.maestroGrupo && <p className="muted small" style={{ margin: '10px 0 0' }}>Maestro(a) de grupo: {alumno.maestroGrupo}</p>}
          </div>
          <div className="row">
            <button className="icon-btn" aria-label="Editar" onClick={() => setEdit(alumno)}><Pencil size={20} /></button>
            <button className="icon-btn danger" aria-label="Eliminar" onClick={eliminarAlumno}><Trash2 size={20} /></button>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <Btn size="lg" variant="sun" block icon={<ClipboardPen size={26} />} onClick={nueva}>Nueva evaluación</Btn>
        </div>
      </Card>

      <Card delay={0.1}>
        <CardTitle icon={<FileText size={24} />}>Evaluaciones</CardTitle>
        {evals && evals.length === 0 ? (
          <div className="empty">
            <Mascot size={110} mood="wave" />
            <h3>Sin evaluaciones todavía</h3>
            <p>Presiona "Nueva evaluación" para aplicar la prueba.</p>
          </div>
        ) : (
          <motion.div className="list" variants={stagger} initial="hidden" animate="show" style={{ marginTop: 14 }}>
            <AnimatePresence>
              {evals?.map((e) => {
                const p = Math.round(progresoPrueba(e.test) * 100)
                return (
                  <motion.div key={e.id} variants={riseItem} className="list-item">
                    <span className="card-icon" style={{ background: 'var(--lav-100)', color: 'var(--lav-600)' }}><CalendarDays size={24} /></span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div className="li-title">{fechaLarga(e.fecha)}</div>
                      <div className="row" style={{ gap: 10, marginTop: 6 }}>
                        <div className="progress" style={{ width: 120, height: 10 }}><motion.div initial={{ width: 0 }} animate={{ width: `${p}%` }} transition={{ duration: 0.8 }} /></div>
                        <span className="small muted">{p}% de la prueba</span>
                        <EstadoBadge estado={e.estado} />
                      </div>
                    </div>
                    <div className="row">
                      <Link to={`/evaluacion/${e.id}`}><Btn size="sm" variant="ghost">Prueba</Btn></Link>
                      <Link to={`/evaluacion/${e.id}/informe`}><Btn size="sm">Informe</Btn></Link>
                      <button className="icon-btn danger" aria-label="Eliminar evaluación" onClick={() => borrarEval(e)}><Trash2 size={20} /></button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </Card>

      <StudentForm value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); toast('Cambios guardados') }} />
      {node}
    </>
  )
}
