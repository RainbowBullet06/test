import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BookOpen, Brain, Check, CheckCheck, ClipboardList, Ear, FileText, Info, Lightbulb, MessageCircle,
  Mic, PenLine, Smile, Sparkles, Wind,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Btn, Card, CardTitle, Chips, Mascot, Modal, Toggle, spring } from '../components/ui'
import {
  AUDITIVA, EDADES_FONEMAS, ELEMENTOS, FONEMAS, MODO_ARTICULACION, ORACIONES, ORGANOS, PUNTO_ARTICULACION, RESPIRACION,
  SEMANTICO, VOZ, edadEsperada,
} from '../data/formato'
import { db, type Alteracion, type Evaluation, type TestData } from '../db'
import { clasificar, erroresFonologicos, fonemasAfectados, progresoPrueba } from '../lib/analisis'

const PASOS = [
  { t: 'Datos', icon: ClipboardList },
  { t: 'Aparato fonoarticulador', icon: Smile },
  { t: 'Voz y audición', icon: Ear },
  { t: 'Pragmático y morfosintaxis', icon: MessageCircle },
  { t: 'Semántico', icon: Brain },
  { t: 'Fonológico', icon: Mic },
  { t: 'Conclusiones', icon: PenLine },
]

const SI_NO = ['si', 'no'] as const
const siNoLabels = { si: 'Sí', no: 'No' }
const tone = (v: 'si' | 'no') => (v === 'si' ? 'yes' : 'no') as 'yes' | 'no'

export default function Wizard() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const [ev, setEv] = useState<Evaluation | null>(null)
  const [dir, setDir] = useState(1)
  const [saved, setSaved] = useState(true)
  const timer = useRef<number | undefined>(undefined)
  const alumno = useLiveQuery(() => (ev ? db.students.get(ev.studentId) : undefined), [ev?.studentId])

  useEffect(() => { db.evaluations.get(id).then((e) => setEv(e ?? null)) }, [id])

  const persist = useCallback((next: Evaluation) => {
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      timer.current = undefined
      await db.evaluations.put({ ...next, updatedAt: Date.now() })
      setSaved(true)
    }, 400)
  }, [])

  // guarda cambios pendientes al salir
  const latest = useRef(ev)
  latest.current = ev
  useEffect(() => () => {
    // solo si quedó un guardado pendiente
    if (timer.current !== undefined && latest.current) {
      clearTimeout(timer.current)
      db.evaluations.put({ ...latest.current, updatedAt: Date.now() })
    }
  }, [])

  const update = useCallback((fn: (e: Evaluation) => void) => {
    setEv((prev) => {
      if (!prev) return prev
      const next = structuredClone(prev)
      fn(next)
      persist(next)
      return next
    })
  }, [persist])
  const ut = useCallback((fn: (t: TestData) => void) => update((e) => fn(e.test)), [update])

  if (ev === null) return <div className="card empty"><Mascot mood="think" /><h3>Cargando evaluación...</h3></div>

  const paso = ev.paso
  const ir = (p: number) => {
    setDir(p > paso ? 1 : -1)
    update((e) => { e.paso = p })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const progreso = progresoPrueba(ev.test)

  async function terminar() {
    update((e) => { if (e.estado === 'en-proceso') e.estado = 'prueba-lista' })
    await new Promise((r) => setTimeout(r, 450))
    navigate(`/evaluacion/${id}/informe`)
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <Btn variant="ghost" size="sm" icon={<ArrowLeft size={20} />} onClick={() => navigate(alumno ? `/alumnos/${alumno.id}` : '/')}>Salir</Btn>
        <div className="spacer" />
        <AnimatePresence initial={false}>
          <motion.span key={String(saved)} className={`badge ${saved ? 'mint' : 'sun'}`} initial={{ y: -6 }} animate={{ y: 0 }}>
            {saved ? <><Check size={14} strokeWidth={3} /> Guardado</> : 'Guardando...'}
          </motion.span>
        </AnimatePresence>
        <Btn variant="primary" size="sm" icon={<FileText size={20} />} onClick={() => navigate(`/evaluacion/${id}/informe`)}>Informe</Btn>
      </div>

      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 10 }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <div className="eyebrow"><Sparkles size={16} /> Evaluación de comunicación verbal</div>
          <h1 style={{ fontSize: 'clamp(1.6rem,3.2vw,2.4rem)', color: 'var(--lav-800)' }}>{alumno?.nombre ?? '...'}</h1>
        </div>
        <div style={{ flex: '0 1 240px', minWidth: 200 }}>
          <div className="row small muted" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span>Avance de la prueba</span><strong style={{ color: 'var(--lav-700)' }}>{Math.round(progreso * 100)}%</strong>
          </div>
          <div className="progress"><motion.div animate={{ width: `${Math.max(4, progreso * 100)}%` }} transition={spring} /></div>
        </div>
      </div>

      <div className="stepper">
        {PASOS.map((p, i) => (
          <motion.button key={p.t} className={`step ${i === paso ? 'current' : ''} ${i < paso ? 'done' : ''}`} onClick={() => ir(i)} whileTap={{ scale: 0.94 }} layout>
            <span className="num">{i < paso ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
            {p.t}
          </motion.button>
        ))}
      </div>

      <AnimatePresence initial={false}>
        <motion.div key={paso}
          initial={{ x: dir * 40 }} animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
          {paso === 0 && <PasoDatos ev={ev} update={update} />}
          {paso === 1 && <PasoFono t={ev.test} ut={ut} />}
          {paso === 2 && <PasoVoz t={ev.test} ut={ut} />}
          {paso === 3 && <PasoPragma t={ev.test} ut={ut} />}
          {paso === 4 && <PasoSemantico t={ev.test} ut={ut} />}
          {paso === 5 && <PasoFonologico t={ev.test} ut={ut} />}
          {paso === 6 && <PasoConclusion t={ev.test} ut={ut} progreso={progreso} />}
        </motion.div>
      </AnimatePresence>

      <div className="wizard-nav">
        <Btn variant="ghost" size="lg" icon={<ArrowLeft size={24} />} disabled={paso === 0} onClick={() => ir(paso - 1)}>
          <span className="hide-sm">Atrás</span>
        </Btn>
        <div className="spacer" />
        {paso < PASOS.length - 1 ? (
          <Btn size="lg" onClick={() => ir(paso + 1)} style={{ flex: '1 1 auto', maxWidth: 360 }}>
            <span className="hide-sm">Siguiente:</span> {PASOS[paso + 1].t.split(" ")[0]} <ArrowRight size={24} />
          </Btn>
        ) : (
          <Btn size="lg" variant="sun" onClick={terminar} icon={<FileText size={24} />} style={{ flex: '1 1 auto', maxWidth: 360 }}>
            Ir al informe
          </Btn>
        )}
      </div>
    </>
  )
}

type UT = (fn: (t: TestData) => void) => void

/* ---------------- Paso 0: datos ---------------- */
function PasoDatos({ ev, update }: { ev: Evaluation; update: (fn: (e: Evaluation) => void) => void }) {
  const f = (k: 'fecha' | 'lugar' | 'aplicador' | 'maestroGrupo' | 'ciclo' | 'edadTexto', label: string, ph = '', type = 'text') => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input id={k} type={type} className="input" value={ev[k]} placeholder={ph} onChange={(e) => update((x) => { x[k] = e.target.value })} />
    </div>
  )
  return (
    <Card>
      <CardTitle icon={<ClipboardList size={24} />} sub="Estos datos aparecen en el encabezado del informe.">Datos de la aplicación</CardTitle>
      <div className="form-grid">
        {f('fecha', 'Fecha de aplicación', '', 'date')}
        {f('lugar', 'Lugar de aplicación', 'Ej. Culiacán, Sinaloa')}
        {f('edadTexto', 'Edad del alumno', 'Ej. 6 años')}
        {f('ciclo', 'Ciclo escolar', 'Ej. 2026-2027')}
        {f('aplicador', 'Aplicador(a) / especialista', 'Tu nombre')}
        {f('maestroGrupo', 'Maestro(a) de grupo', 'Nombre del docente')}
      </div>
    </Card>
  )
}

/* ---------------- Paso 1: aparato fonoarticulador ---------------- */
function PasoFono({ t, ut }: { t: TestData; ut: UT }) {
  const todosSi = () => ut((x) => ORGANOS.forEach((o) => { if (!x.organos[o].funcional) x.organos[o].funcional = 'si' }))
  return (
    <>
      <Card>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <CardTitle icon={<Smile size={24} />} sub="Características funcionales de cada órgano. Anota observaciones de forma, tamaño o movimiento.">Aparato fonoarticulador</CardTitle>
          </div>
          <Btn size="sm" variant="mint" icon={<CheckCheck size={20} />} onClick={todosSi}>Todos funcionales</Btn>
        </div>
        {ORGANOS.map((o) => (
          <div className="item-row" key={o}>
            <span className="item-name">{o}</span>
            <Chips options={SI_NO} labels={siNoLabels} tone={tone} value={t.organos[o].funcional}
              onChange={(v) => ut((x) => { x.organos[o].funcional = v })} />
            <input className="input" placeholder="Observaciones (opcional)" value={t.organos[o].obs}
              onChange={(e) => ut((x) => { x.organos[o].obs = e.target.value })} />
          </div>
        ))}
      </Card>
      <Card delay={0.08}>
        <CardTitle icon={<Wind size={24} />} color="#e3f4ff" fg="#1d6fa8" sub="Selecciona el tipo de respiración observado.">Tipo de respiración</CardTitle>
        <div className="grid grid-3">
          {RESPIRACION.map((r) => {
            const on = t.respiracion === r.id
            return (
              <motion.button key={r.id} type="button" className="card" whileTap={{ scale: 0.97 }} whileHover={{ y: -3 }}
                onClick={() => ut((x) => { x.respiracion = on ? '' : r.id })}
                style={{ textAlign: 'left', cursor: 'pointer', border: `3px solid ${on ? 'var(--lav-500)' : 'transparent'}`, background: on ? 'var(--lav-50)' : '#fff' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--lav-800)' }}>{r.nombre}</strong>
                  <AnimatePresence>{on && <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={spring} className="card-icon" style={{ width: 34, height: 34, borderRadius: 12, background: 'var(--lav-500)', color: '#fff' }}><Check size={20} strokeWidth={3} /></motion.span>}</AnimatePresence>
                </div>
                <p className="small muted" style={{ margin: '8px 0 0' }}>{r.desc}</p>
              </motion.button>
            )
          })}
        </div>
      </Card>
    </>
  )
}

/* ---------------- Paso 2: voz y audición ---------------- */
function PasoVoz({ t, ut }: { t: TestData; ut: UT }) {
  return (
    <>
      <Card>
        <CardTitle icon={<Mic size={24} />} color="#fff2cf" fg="#8a5a00" sub="Suprasegmentos de voz: elige una opción por renglón.">Suprasegmentos de voz</CardTitle>
        {VOZ.map((v) => (
          <div className="item-row" key={v.id} style={{ gridTemplateColumns: 'minmax(150px, 1fr) 3fr' }}>
            <span className="item-name">{v.nombre}</span>
            <Chips options={v.opciones} size="lg" value={(t.voz[v.id] as (typeof v.opciones)[number]) || ''} onChange={(o) => ut((x) => { x.voz[v.id] = o ?? '' })} />
          </div>
        ))}
      </Card>
      <Card delay={0.08}>
        <CardTitle icon={<Ear size={24} />} color="#dcf7ec" fg="#11704d">Discriminación auditiva</CardTitle>
        {AUDITIVA.map((a) => (
          <div className="item-row" key={a.id}>
            <span className="item-name">{a.texto}</span>
            <Chips options={SI_NO} labels={siNoLabels} tone={tone} value={t.auditiva[a.id].valor} onChange={(v) => ut((x) => { x.auditiva[a.id].valor = v })} />
            <input className="input" placeholder="Observaciones" value={t.auditiva[a.id].obs} onChange={(e) => ut((x) => { x.auditiva[a.id].obs = e.target.value })} />
          </div>
        ))}
      </Card>
    </>
  )
}

/* ---------------- Paso 3: pragmático y morfosintáctico ---------------- */
function PasoPragma({ t, ut }: { t: TestData; ut: UT }) {
  const copiarDeMuestra = () => {
    const frases = t.muestraOral.split(/(?<=[.!?,])\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 3)
    ut((x) => { x.enunciados = [0, 1, 2].map((i) => x.enunciados[i] || frases[i] || '') })
  }
  return (
    <>
      <Card>
        <CardTitle icon={<MessageCircle size={24} />} sub="Muestra de una producción oral en el contexto inmediato del alumno. Se sugieren dos minutos de grabación y la transcripción del contenido rescatado.">
          Aspecto pragmático
        </CardTitle>
        <textarea className="textarea" style={{ minHeight: 170, fontSize: '1.1rem' }} value={t.muestraOral}
          placeholder="Escribe aquí lo que dijo el alumno, tal como lo dijo..." onChange={(e) => ut((x) => { x.muestraOral = e.target.value })} />
        <p className="hint" style={{ marginTop: 8 }}><Info size={14} style={{ verticalAlign: -2 }} /> Escribe la emisión literal, con sus errores (ej. "un niño duemiendo").</p>
      </Card>
      <Card delay={0.08}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <CardTitle icon={<BookOpen size={24} />} color="#ffe5e3" fg="#b0302b" sub="Rescata tres enunciados de la muestra y analiza la competencia lingüística.">Aspecto morfosintáctico</CardTitle>
          </div>
          {t.muestraOral.trim() && <Btn size="sm" variant="ghost" onClick={copiarDeMuestra}>Tomar de la muestra</Btn>}
        </div>
        <div className="list" style={{ gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div className="row" key={i} style={{ flexWrap: 'nowrap' }}>
              <span className="card-icon" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--lav-100)', color: 'var(--lav-700)', fontWeight: 800 }}>{i + 1}</span>
              <input className="input" value={t.enunciados[i] ?? ''} placeholder={`Enunciado ${i + 1}`} onChange={(e) => ut((x) => { x.enunciados[i] = e.target.value })} />
            </div>
          ))}
        </div>
        <div className="field" style={{ marginTop: 22 }}>
          <span className="label">Tipos de oraciones</span>
          <div className="chips">
            {ORACIONES.map((o) => <Toggle key={o} on={!!t.oraciones[o]} onChange={(v) => ut((x) => { x.oraciones[o] = v })}>{o}</Toggle>)}
          </div>
        </div>
        <div className="field" style={{ marginTop: 18 }}>
          <span className="label">Elementos morfosintácticos que utiliza</span>
          <div className="chips">
            {ELEMENTOS.map((o, i) => <Toggle key={o} on={!!t.elementos[o]} onChange={(v) => ut((x) => { x.elementos[o] = v })}>{i < 8 ? `${i + 1}. ` : ''}{o}</Toggle>)}
          </div>
        </div>
      </Card>
    </>
  )
}

/* ---------------- Paso 4: semántico ---------------- */
function PasoSemantico({ t, ut }: { t: TestData; ut: UT }) {
  return (
    <Card>
      <CardTitle icon={<Brain size={24} />} color="#e3f4ff" fg="#1d6fa8" sub="Elige el vocabulario de las tarjetas fonológicas y semánticas. Registra la respuesta emitida por el alumno.">Aspecto semántico</CardTitle>
      <div className="list">
        {SEMANTICO.map((s, idx) => {
          const r = t.semantico[s.id]
          const partes = s.pregunta.split('___')
          return (
            <motion.div key={s.id} className="card" style={{ padding: 18, boxShadow: 'none', border: '2px solid var(--lav-100)' }}
              initial={{ y: 12 }} animate={{ y: 0 }} transition={{ delay: idx * 0.05 }}>
              <div className="row" style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 500, color: 'var(--lav-800)', gap: 8 }}>
                {partes.map((p, i) => (
                  <span key={i} className="row" style={{ gap: 8 }}>
                    <span>{p}</span>
                    {i < partes.length - 1 && (
                      <input className="input" style={{ width: 150, minHeight: 46, padding: '8px 12px' }} placeholder="objeto" value={r.objetos[i] ?? ''}
                        onChange={(e) => ut((x) => { x.semantico[s.id].objetos[i] = e.target.value })} />
                    )}
                  </span>
                ))}
              </div>
              {s.ayuda && <p className="hint" style={{ margin: '8px 0 0' }}>{s.ayuda}</p>}
              <div className="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
                <input className="input" style={{ flex: '2 1 240px' }} placeholder="Respuesta del alumno" value={r.respuesta}
                  onChange={(e) => ut((x) => { x.semantico[s.id].respuesta = e.target.value })} />
                <Chips options={['correcta', 'incorrecta'] as const} labels={{ correcta: 'Correcta', incorrecta: 'Incorrecta' }}
                  tone={(v) => (v === 'correcta' ? 'yes' : 'no')} value={r.resultado} onChange={(v) => ut((x) => { x.semantico[s.id].resultado = v })} />
              </div>
            </motion.div>
          )
        })}
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="ns">Notas adicionales</label>
        <textarea id="ns" className="textarea" value={t.notasSemantico} placeholder="Otras preguntas o respuestas registradas..." onChange={(e) => ut((x) => { x.notasSemantico = e.target.value })} />
      </div>
    </Card>
  )
}

/* ---------------- Paso 5: fonológico ---------------- */
function PasoFonologico({ t, ut }: { t: TestData; ut: UT }) {
  const [ref, setRef] = useState(false)
  const errores = erroresFonologicos(t)
  const evaluados = FONEMAS.filter((f) => t.fonemas[f.n].estado).length
  const pendientesBien = () => ut((x) => FONEMAS.forEach((f) => { if (!x.fonemas[f.n].estado) x.fonemas[f.n].estado = 'bien' }))
  const grupos = ['Fonemas', 'Sinfones', 'Diptongos'] as const

  return (
    <>
      <Card>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <CardTitle icon={<Mic size={24} />} color="#ffe5e3" fg="#b0302b"
              sub="Articulación: marca ✓ si la dice bien. Si hay error, escribe cómo lo dijo y marca O (omisión), S (sustitución) o D (distorsión) según la posición.">
              Aspecto fonológico
            </CardTitle>
          </div>
          <div className="row">
            <Btn size="sm" variant="ghost" icon={<Lightbulb size={20} />} onClick={() => setRef(true)}>Referentes</Btn>
            <Btn size="sm" variant="mint" icon={<CheckCheck size={20} />} onClick={pendientesBien}>Pendientes = bien</Btn>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <span className="badge lav">{evaluados} / {FONEMAS.length} evaluadas</span>
          <span className="badge coral">{errores.length} con error</span>
          {fonemasAfectados(errores).length > 0 && <span className="badge sun">Afectados: {fonemasAfectados(errores).map((f) => `/${f}/`).join(' ')}</span>}
        </div>
      </Card>

      {grupos.map((g) => (
        <div key={g}>
          <div className="group-title">{g}</div>
          <div className="fon-grid">
            {FONEMAS.filter((f) => f.grupo === g).map((f) => {
              const r = t.fonemas[f.n]
              const esperado = edadEsperada(f.fonema)
              return (
                <motion.div key={f.n} layout className={`fon-card ${r.estado ?? ''}`} transition={spring}>
                  <div className="fon-top">
                    <span className="fon-n">{f.n}</span>
                    <span className="fon-sym">/{f.fonema}/</span>
                    <span className="fon-word">{f.palabra}</span>
                    {esperado && <span className="badge lav" style={{ marginLeft: 'auto' }} title="Edad aproximada en que se adquiere">{esperado}+</span>}
                  </div>
                  <div className="fon-actions">
                    <motion.button type="button" whileTap={{ scale: 0.9 }} className={`fon-btn ok ${r.estado === 'bien' ? 'on' : ''}`}
                      onClick={() => ut((x) => { x.fonemas[f.n].estado = r.estado === 'bien' ? null : 'bien' })}>
                      <Check size={20} strokeWidth={3} /> Bien
                    </motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.9 }} className={`fon-btn bad ${r.estado === 'error' ? 'on' : ''}`}
                      onClick={() => ut((x) => { x.fonemas[f.n].estado = r.estado === 'error' ? null : 'error' })}>
                      Error
                    </motion.button>
                  </div>
                  <AnimatePresence initial={false}>
                    {r.estado === 'error' && (
                      <div className="entrar">
                        <input className="input" style={{ marginTop: 12, minHeight: 50 }} placeholder="¿Cómo lo dijo?" value={r.emision}
                          onChange={(e) => ut((x) => { x.fonemas[f.n].emision = e.target.value })} />
                        <div className="pos-grid">
                          {(['inicial', 'media', 'final'] as const).map((p) => (
                            <div className="pos" key={p}>
                              <span>{p}</span>
                              <div className="pos-opts">
                                {(['O', 'S', 'D'] as Alteracion[]).map((a) => (
                                  <button type="button" key={a} className={r[p] === a ? 'on' : ''}
                                    onClick={() => ut((x) => { x.fonemas[f.n][p] = r[p] === a ? '' : a })}>{a}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}

      <Modal open={ref} onClose={() => setRef(false)} title="Referentes fonológicos" icon={<span className="card-icon" style={{ background: '#fff2cf', color: '#8a5a00' }}><Lightbulb size={24} /></span>}>
        <Referentes />
      </Modal>
    </>
  )
}

export function Referentes() {
  return (
    <div className="list" style={{ gap: 20 }}>
      <div>
        <h3 style={{ color: 'var(--lav-700)', marginBottom: 8 }}>Punto de articulación</h3>
        <table className="ref-table"><tbody>
          {PUNTO_ARTICULACION.map((p) => <tr key={p.nombre}><th>{p.nombre}</th><td>{p.fonemas.map((f) => `/${f}/`).join(' ')}</td></tr>)}
        </tbody></table>
      </div>
      <div>
        <h3 style={{ color: 'var(--lav-700)', marginBottom: 8 }}>Modo de articulación</h3>
        <table className="ref-table"><tbody>
          {MODO_ARTICULACION.map((m) => <tr key={m.nombre}><th>{m.nombre}</th><td>{m.fonemas.map((f) => `/${f}/`).join(' ')}<div className="small muted">{m.desc}</div></td></tr>)}
        </tbody></table>
      </div>
      <div>
        <h3 style={{ color: 'var(--lav-700)', marginBottom: 8 }}>Edades aproximadas para articular los fonemas</h3>
        <table className="ref-table">
          <thead><tr><th>Edad</th><th>Sonidos del habla</th></tr></thead>
          <tbody>{EDADES_FONEMAS.map((e) => <tr key={e.edad}><td><strong>{e.edad}</strong></td><td>{e.sonidos.join(', ')}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

/* ---------------- Paso 6: conclusiones ---------------- */
function PasoConclusion({ t, ut, progreso }: { t: TestData; ut: UT; progreso: number }) {
  const errores = erroresFonologicos(t)
  const { punto, modo } = clasificar(fonemasAfectados(errores))
  const incorrectas = SEMANTICO.filter((s) => t.semantico[s.id].resultado === 'incorrecta').length
  return (
    <>
      <Card>
        <div className="row" style={{ alignItems: 'center', gap: 20 }}>
          <Mascot size={120} mood={progreso > 0.8 ? 'cheer' : 'happy'} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ fontSize: '1.6rem', color: 'var(--lav-800)' }}>{progreso > 0.8 ? '¡Excelente trabajo!' : '¡Ya casi!'}</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Llevas el {Math.round(progreso * 100)}% de la prueba. Puedes regresar a cualquier paso tocando su nombre arriba.
            </p>
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: 20 }}>
          <Resumen label="Órganos con dificultad" value={ORGANOS.filter((o) => t.organos[o].funcional === 'no').length} />
          <Resumen label="Respuestas semánticas incorrectas" value={incorrectas} />
          <Resumen label="Palabras con error fonológico" value={errores.length} />
          <Resumen label="Punto / modo afectado" text={[...punto, ...modo].join(', ') || '—'} />
        </div>
      </Card>
      <Card delay={0.08}>
        <CardTitle icon={<PenLine size={24} />} sub="Tus conclusiones de la prueba (también se usan como guía para la IA).">Conclusiones</CardTitle>
        <textarea className="textarea" style={{ minHeight: 180 }} value={t.conclusiones} placeholder="Escribe tus conclusiones..."
          onChange={(e) => ut((x) => { x.conclusiones = e.target.value })} />
      </Card>
    </>
  )
}

function Resumen({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 20, background: 'var(--lav-50)', border: '2px solid var(--lav-100)' }}>
      <div className="stat-num" style={{ fontSize: text ? '1.1rem' : '2rem' }}>{text ?? value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
