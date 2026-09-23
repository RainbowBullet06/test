import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, GraduationCap, Plus, School, Search, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Btn, Chips, Mascot, Modal, PageHead, avatarColor, iniciales, riseItem, stagger, useToast } from '../components/ui'
import { calcularEdad, db, edadDeAlumno, type Student } from '../db'

const GRADOS = ['1°', '2°', '3°', '4°', '5°', '6°'] as const
const SEXOS = ['F', 'M'] as const

export default function Students() {
  const [params, setParams] = useSearchParams()
  const escuelaId = Number(params.get('escuela')) || null
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Student | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const schools = useLiveQuery(() => db.schools.orderBy('nombre').toArray())
  const students = useLiveQuery(() => db.students.orderBy('nombre').toArray())
  const schoolById = new Map(schools?.map((s) => [s.id!, s]))
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  const lista = students?.filter((s) => (!escuelaId || s.schoolId === escuelaId) && norm(s.nombre).includes(norm(q)))

  const nuevo = () =>
    setEdit({ nombre: '', sexo: 'F', grado: '', grupo: '', schoolId: escuelaId ?? schools?.[0]?.id ?? 0, fechaNacimiento: '', edad: '', maestroGrupo: '', notas: '', createdAt: Date.now() })

  return (
    <>
      <PageHead
        eyebrow={<><GraduationCap size={16} /> Alumnos</>}
        title="Mis alumnos"
        sub="Toca un alumno para ver o iniciar sus evaluaciones."
        actions={<>
          <Btn variant="ghost" icon={<School size={22} />} onClick={() => navigate('/escuelas')}>Escuelas</Btn>
          {schools?.length ? <Btn size="lg" icon={<Plus size={24} />} onClick={nuevo}>Agregar alumno</Btn> : null}
        </>}
      />

      {schools && schools.length === 0 ? (
        <div className="card empty">
          <Mascot size={130} mood="think" />
          <h3>Primero agrega una escuela</h3>
          <p>Los alumnos se registran dentro de una escuela.</p>
          <Btn size="lg" variant="sun" icon={<Plus size={24} />} onClick={() => navigate('/escuelas')}>Ir a escuelas</Btn>
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 18 }}>
            <div className="search">
              <Search size={22} />
              <input className="input" placeholder="Buscar alumno..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {schools && schools.length > 1 && (
            <div className="chips" style={{ marginBottom: 20 }}>
              <SchoolChip on={!escuelaId} onClick={() => setParams({})}>Todas</SchoolChip>
              {schools.map((s) => (
                <SchoolChip key={s.id} on={escuelaId === s.id} onClick={() => setParams({ escuela: String(s.id) })}>{s.nombre}</SchoolChip>
              ))}
            </div>
          )}

          {lista && lista.length === 0 ? (
            <div className="card empty">
              <Mascot size={120} mood="wave" />
              <h3>{q ? 'No encontré a nadie con ese nombre' : 'Aún no hay alumnos aquí'}</h3>
              {!q && <Btn size="lg" variant="sun" icon={<Plus size={24} />} onClick={nuevo}>Agregar alumno</Btn>}
            </div>
          ) : (
            <motion.div className="list" variants={stagger} initial="hidden" animate="show">
              <AnimatePresence>
                {lista?.map((s) => (
                  <motion.div key={s.id} variants={riseItem} layout exit={{ opacity: 0, x: -30 }}>
                    <Link to={`/alumnos/${s.id}`} className="list-item clickable">
                      <motion.span className="avatar" style={{ background: avatarColor(s.nombre) }} whileHover={{ rotate: -8, scale: 1.08 }}>{iniciales(s.nombre)}</motion.span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="li-title">{s.nombre}</div>
                        <div className="li-sub">
                          {[s.grado && `${s.grado} ${s.grupo ?? ''}`.trim(), edadDeAlumno(s), schoolById.get(s.schoolId)?.nombre].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <ArrowRight size={22} color="var(--lav-400)" />
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      <StudentForm value={edit} onClose={() => setEdit(null)} onSaved={(id, nuevo) => { setEdit(null); toast(nuevo ? 'Alumno agregado' : 'Cambios guardados'); if (nuevo) navigate(`/alumnos/${id}`) }} />
    </>
  )
}

function SchoolChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button type="button" className={`chip ${on ? 'on' : ''}`} onClick={onClick} whileTap={{ scale: 0.92 }}>
      {on && <motion.span layoutId="school-chip" className="chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
      <span>{children}</span>
    </motion.button>
  )
}

export function StudentForm({ value, onClose, onSaved }: { value: Student | null; onClose: () => void; onSaved: (id: number, nuevo: boolean) => void }) {
  const schools = useLiveQuery(() => db.schools.orderBy('nombre').toArray())
  const [f, setF] = useState<Student | null>(value)
  const [last, setLast] = useState(value)
  if (value !== last) { setLast(value); setF(value) }
  const set = (p: Partial<Student>) => setF((x) => (x ? { ...x, ...p } : x))
  const edadCalc = calcularEdad(f?.fechaNacimiento)
  const valido = !!f?.nombre.trim() && !!f.schoolId

  async function save() {
    if (!f || !valido) return
    const nuevo = !f.id
    const id = await db.students.put({ ...f, nombre: f.nombre.trim() })
    onSaved(id, nuevo)
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? 'Editar alumno' : 'Nuevo alumno'}
      icon={<span className="card-icon" style={{ background: '#ffe5e3', color: '#b0302b' }}><UserRound size={24} /></span>}>
      {f && (
        <form onSubmit={(e) => { e.preventDefault(); save() }} className="form-grid">
          <div className="field full">
            <label htmlFor="an">Nombre completo *</label>
            <input id="an" className="input" autoFocus value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Nombre y apellidos" />
          </div>
          <div className="field full">
            <span className="label">Sexo</span>
            <Chips options={SEXOS} size="lg" value={f.sexo} onChange={(v) => v && set({ sexo: v })} labels={{ F: '👧 Niña', M: '👦 Niño' }} />
          </div>
          <div className="field">
            <label htmlFor="fn">Fecha de nacimiento</label>
            <input id="fn" type="date" className="input" value={f.fechaNacimiento ?? ''} onChange={(e) => set({ fechaNacimiento: e.target.value })} />
            {edadCalc !== null && <span className="hint">Edad calculada: {edadCalc} años</span>}
          </div>
          <div className="field">
            <label htmlFor="ed">Edad (si no sabes la fecha)</label>
            <input id="ed" className="input" inputMode="decimal" value={f.edad ?? ''} disabled={edadCalc !== null}
              onChange={(e) => set({ edad: e.target.value })} placeholder="Ej. 6" />
          </div>
          <div className="field full">
            <span className="label">Grado</span>
            <Chips options={GRADOS} size="lg" value={(GRADOS as readonly string[]).includes(f.grado) ? (f.grado as (typeof GRADOS)[number]) : ''} onChange={(v) => set({ grado: v ?? '' })} />
            <input className="input" value={f.grado} onChange={(e) => set({ grado: e.target.value })} placeholder="O escribe otro (ej. 3° preescolar)" />
          </div>
          <div className="field">
            <label htmlFor="gr">Grupo / sección</label>
            <input id="gr" className="input" value={f.grupo ?? ''} onChange={(e) => set({ grupo: e.target.value.toUpperCase() })} placeholder="Ej. A" />
          </div>
          <div className="field">
            <label htmlFor="es">Escuela *</label>
            <select id="es" className="select input" value={f.schoolId || ''} onChange={(e) => set({ schoolId: Number(e.target.value) })}>
              <option value="" disabled>Selecciona...</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="field full">
            <label htmlFor="mg">Maestro(a) de grupo</label>
            <input id="mg" className="input" value={f.maestroGrupo ?? ''} onChange={(e) => set({ maestroGrupo: e.target.value })} placeholder="Nombre del docente de grupo" />
          </div>
          <div className="field full">
            <label htmlFor="no">Notas</label>
            <textarea id="no" className="textarea" value={f.notas ?? ''} onChange={(e) => set({ notas: e.target.value })} placeholder="Información relevante (opcional)" />
          </div>
          <div className="full row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn type="submit" variant="mint" size="lg" disabled={!valido}>Guardar</Btn>
          </div>
        </form>
      )}
    </Modal>
  )
}
