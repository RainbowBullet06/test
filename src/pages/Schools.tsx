import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { GraduationCap, MapPin, Pencil, Plus, School as SchoolIcon, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Btn, Chips, Mascot, Modal, PageHead, avatarColor, iniciales, riseItem, stagger, useConfirm, useToast } from '../components/ui'
import { borrarEscuela, db, type School } from '../db'

const TIPOS = ['USAER', 'CAM', 'Otro'] as const
const TURNOS = ['Matutino', 'Vespertino', 'Tiempo completo'] as const

export default function Schools() {
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [edit, setEdit] = useState<School | null>(null)
  const schools = useLiveQuery(() => db.schools.orderBy('nombre').toArray())
  const counts = useLiveQuery(async () => {
    const m = new Map<number, number>()
    for (const s of await db.students.toArray()) m.set(s.schoolId, (m.get(s.schoolId) ?? 0) + 1)
    return m
  })

  const nueva = () => setEdit({ nombre: '', cct: '', tipo: 'USAER', localidad: '', turno: 'Matutino', createdAt: Date.now() })

  async function borrar(s: School) {
    const n = counts?.get(s.id!) ?? 0
    const ok = await confirm(n
      ? `La escuela "${s.nombre}" tiene ${n} alumno(s). Se eliminarán también sus alumnos y evaluaciones.`
      : `Se eliminará la escuela "${s.nombre}".`)
    if (!ok) return
    await borrarEscuela(s.id!)
    toast('Escuela eliminada')
  }

  return (
    <>
      <PageHead
        eyebrow={<><SchoolIcon size={16} /> Escuelas</>}
        title="Mis escuelas"
        sub="Las escuelas donde atiendes alumnos."
        actions={<Btn size="lg" icon={<Plus size={24} />} onClick={nueva}>Agregar escuela</Btn>}
      />

      {schools && schools.length === 0 ? (
        <motion.div className="card empty" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
          <Mascot size={130} mood="wave" />
          <h3>Agrega tu primera escuela</h3>
          <p>Primero registra la escuela; después podrás dar de alta a sus alumnos.</p>
          <Btn size="lg" variant="sun" icon={<Plus size={24} />} onClick={nueva}>Agregar escuela</Btn>
        </motion.div>
      ) : (
        <motion.div className="grid grid-2" variants={stagger} initial="hidden" animate="show">
          <AnimatePresence>
            {schools?.map((s) => (
              <motion.div key={s.id} variants={riseItem} className="card" whileHover={{ y: -4 }}>
                <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span className="avatar" style={{ background: avatarColor(s.nombre), width: 62, height: 62, borderRadius: 20 }}>{iniciales(s.nombre)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="li-title" style={{ fontSize: '1.25rem' }}>{s.nombre}</div>
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      {s.tipo && <span className="badge lav">{s.tipo}</span>}
                      {s.turno && <span className="badge sun">{s.turno}</span>}
                      {s.cct && <span className="badge mint">CCT {s.cct}</span>}
                    </div>
                    {s.localidad && <div className="li-sub row" style={{ gap: 4, marginTop: 8 }}><MapPin size={15} /> {s.localidad}</div>}
                  </div>
                </div>
                <div className="row" style={{ marginTop: 18 }}>
                  <Btn size="sm" variant="ghost" icon={<GraduationCap size={20} />} onClick={() => navigate(`/alumnos?escuela=${s.id}`)} style={{ flex: 1 }}>
                    {counts?.get(s.id!) ?? 0} alumno(s)
                  </Btn>
                  <button className="icon-btn" aria-label="Editar" onClick={() => setEdit(s)}><Pencil size={20} /></button>
                  <button className="icon-btn danger" aria-label="Eliminar" onClick={() => borrar(s)}><Trash2 size={20} /></button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <SchoolForm value={edit} onClose={() => setEdit(null)} onSaved={(n) => { setEdit(null); toast(n ? 'Escuela agregada' : 'Cambios guardados') }} />
      {node}
    </>
  )
}

function SchoolForm({ value, onClose, onSaved }: { value: School | null; onClose: () => void; onSaved: (nueva: boolean) => void }) {
  const [f, setF] = useState<School | null>(value)
  const [last, setLast] = useState(value)
  if (value !== last) { setLast(value); setF(value) }
  const set = (p: Partial<School>) => setF((x) => (x ? { ...x, ...p } : x))

  async function save() {
    if (!f?.nombre.trim()) return
    const nueva = !f.id
    await db.schools.put({ ...f, nombre: f.nombre.trim() })
    onSaved(nueva)
  }

  return (
    <Modal open={!!value} onClose={onClose} title={value?.id ? 'Editar escuela' : 'Nueva escuela'}
      icon={<span className="card-icon" style={{ background: '#dcf7ec', color: '#11704d' }}><SchoolIcon size={24} /></span>}>
      {f && (
        <form onSubmit={(e) => { e.preventDefault(); save() }} className="form-grid">
          <div className="field full">
            <label htmlFor="sn">Nombre de la escuela *</label>
            <input id="sn" className="input" autoFocus value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} placeholder="Ej. Primaria Benito Juárez" />
          </div>
          <div className="field full">
            <span className="label">Tipo de servicio</span>
            <Chips options={TIPOS} value={(f.tipo as (typeof TIPOS)[number]) ?? ''} onChange={(v) => set({ tipo: v ?? '' })} />
          </div>
          <div className="field full">
            <span className="label">Turno</span>
            <Chips options={TURNOS} value={(f.turno as (typeof TURNOS)[number]) ?? ''} onChange={(v) => set({ turno: v ?? '' })} />
          </div>
          <div className="field">
            <label htmlFor="cct">Clave (CCT)</label>
            <input id="cct" className="input" value={f.cct ?? ''} onChange={(e) => set({ cct: e.target.value.toUpperCase() })} placeholder="Opcional" />
          </div>
          <div className="field">
            <label htmlFor="loc">Localidad</label>
            <input id="loc" className="input" value={f.localidad ?? ''} onChange={(e) => set({ localidad: e.target.value })} placeholder="Ej. Culiacán, Sin." />
          </div>
          <div className="full row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn type="submit" variant="mint" size="lg" disabled={!f.nombre.trim()}>Guardar</Btn>
          </div>
        </form>
      )}
    </Modal>
  )
}
