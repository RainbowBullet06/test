import confetti from 'canvas-confetti'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, Bot, Check, ClipboardCopy, ClipboardPaste, Download, Eye, ExternalLink, FileText, PenLine, ShieldCheck, Sparkles, Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Btn, Card, CardTitle, Mascot, Modal, spring, useConfirm, useToast } from '../components/ui'
import { SECCIONES_INFORME, type SeccionId } from '../data/formato'
import { db, type Evaluation } from '../db'
import { borradorAutomatico } from '../lib/analisis'
import { descargar, fechaLarga, generarInforme, nombreArchivo } from '../lib/docx'
import { generarPrompt, interpretarRespuesta } from '../lib/prompt'
import { guardarInformeEnCarpeta } from '../lib/respaldo'

const IAS = [
  { n: 'ChatGPT', url: 'https://chatgpt.com/' },
  { n: 'Claude', url: 'https://claude.ai/new' },
  { n: 'Gemini', url: 'https://gemini.google.com/app' },
]

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = texto
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

export default function Report() {
  const id = Number(useParams().id)
  const navigate = useNavigate()
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const [ev, setEv] = useState<Evaluation | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [verPrompt, setVerPrompt] = useState(false)
  const [preview, setPreview] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [errorIA, setErrorIA] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const alumno = useLiveQuery(() => (ev ? db.students.get(ev.studentId) : undefined), [ev?.studentId])
  const escuela = useLiveQuery(() => (alumno ? db.schools.get(alumno.schoolId) : undefined), [alumno?.schoolId])

  useEffect(() => { db.evaluations.get(id).then((e) => setEv(e ?? null)) }, [id])

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
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        timer.current = undefined
        db.evaluations.put({ ...next, updatedAt: Date.now() })
      }, 400)
      return next
    })
  }, [])

  if (!ev || !alumno) return <div className="card empty"><Mascot mood="think" /><h3>Cargando informe...</h3></div>

  const auto = borradorAutomatico(ev.test, alumno.sexo)
  const prompt = generarPrompt({
    test: ev.test, sexo: alumno.sexo, edadTexto: ev.edadTexto, grado: alumno.grado,
    privados: [alumno.nombre, escuela?.nombre ?? '', ev.maestroGrupo, ev.aplicador, alumno.maestroGrupo ?? ''],
  })
  const completas = SECCIONES_INFORME.filter((s) => ev.informe[s.id].trim()).length
  const haySugerencias = SECCIONES_INFORME.some((s) => ev.sugerencias[s.id] || auto[s.id])

  async function copiarPrompt() {
    await copiar(prompt)
    setCopiado(true)
    toast('Instrucciones copiadas. Pégalas en ChatGPT, Claude o Gemini.')
    setTimeout(() => setCopiado(false), 2500)
  }

  function leerRespuesta() {
    try {
      const s = interpretarRespuesta(ev!.respuestaIA)
      setErrorIA('')
      update((e) => { e.sugerencias = s })
      toast(`Listo: ${Object.keys(s).length} secciones sugeridas`)
      setTimeout(() => document.getElementById('secciones')?.scrollIntoView({ behavior: 'smooth' }), 300)
    } catch (err) {
      setErrorIA((err as Error).message)
    }
  }

  async function usarTodas() {
    const sobrescribe = SECCIONES_INFORME.some((s) => ev!.informe[s.id].trim() && (ev!.sugerencias[s.id] || auto[s.id]))
    if (sobrescribe && !(await confirm('Algunas secciones ya tienen texto. ¿Reemplazarlas con las sugerencias?'))) return
    update((e) => {
      for (const s of SECCIONES_INFORME) {
        const sug = e.sugerencias[s.id] || auto[s.id]
        if (sug) e.informe[s.id] = sug
      }
    })
    toast('Sugerencias aplicadas. Revisa y ajusta lo que necesites.')
  }

  async function descargarWord() {
    setGenerando(true)
    try {
      const blob = await generarInforme(ev!, alumno!, escuela)
      descargar(blob, nombreArchivo(alumno!, ev!))
      const enCarpeta = await guardarInformeEnCarpeta(blob, ev!, alumno!, escuela).catch(() => null)
      if (enCarpeta) toast('También se guardó en tu carpeta de respaldo')
      update((e) => { e.estado = 'terminada' })
      confetti({ particleCount: 140, spread: 80, origin: { y: 0.7 }, colors: ['#8a63e8', '#c1a8ff', '#ffc857', '#4fd1a1', '#ff7e79'] })
      toast('¡Informe descargado!')
    } catch (err) {
      console.error(err)
      toast('No se pudo generar el documento', 'error')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 14 }}>
        <Btn variant="ghost" size="sm" icon={<ArrowLeft size={20} />} onClick={() => navigate(`/evaluacion/${id}`)}>Volver a la prueba</Btn>
      </div>

      {/* Encabezado */}
      <motion.div className="hero" style={{ padding: '28px 30px' }} initial={{ y: 16 }} animate={{ y: 0 }} transition={spring}>
        <div style={{ position: 'relative', flex: 1 }}>
          <div className="eyebrow" style={{ background: 'rgba(255,255,255,.18)', color: '#fff' }}><FileText size={16} /> Informe de comunicación verbal y no verbal</div>
          <h1>{alumno.nombre}</h1>
          <p style={{ margin: '8px 0 18px' }}>
            {[ev.edadTexto, [alumno.grado, alumno.grupo].filter(Boolean).join(' '), escuela?.nombre, fechaLarga(ev.fecha)].filter(Boolean).join(' · ')}
          </p>
          <div className="row">
            <Btn variant="sun" size="lg" icon={<Download size={24} />} onClick={descargarWord} disabled={generando}>
              {generando ? 'Generando...' : 'Descargar Word'}
            </Btn>
            <Btn variant="ghost" size="lg" icon={<Eye size={24} />} onClick={() => setPreview(true)}>Vista previa</Btn>
          </div>
        </div>
        <div className="hero-mascot" style={{ textAlign: 'center' }}>
          <Mascot size={150} mood={completas === 7 ? 'cheer' : 'happy'} />
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginTop: 4 }}>{completas} de 7 secciones</div>
        </div>
      </motion.div>

      {/* Asistente de IA */}
      <Card delay={0.05} style={{ marginTop: 22 }}>
        <CardTitle icon={<Bot size={24} />} color="#fff2cf" fg="#8a5a00"
          sub="Opcional. Copia las instrucciones, pégalas en ChatGPT, Claude o Gemini y pega aquí la respuesta para verla como sugerencia en cada sección.">
          Redacción asistida
        </CardTitle>

        <div className="privacy" style={{ marginBottom: 18 }}>
          <ShieldCheck size={26} style={{ flex: 'none' }} />
          <div><strong>Protegemos los datos del alumno.</strong> Las instrucciones no incluyen nombre, escuela ni nombres de maestros; solo sexo, edad, grado y resultados de la prueba.</div>
        </div>

        <div className="grid grid-2">
          <div className="card" style={{ boxShadow: 'none', border: '2px solid var(--lav-100)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="card-icon" style={{ background: 'var(--lav-500)', color: '#fff', width: 38, height: 38, borderRadius: 12, fontWeight: 800 }}>1</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Copia las instrucciones</strong>
            </div>
            <Btn block size="lg" variant={copiado ? 'mint' : 'primary'} icon={copiado ? <Check size={24} strokeWidth={3} /> : <ClipboardCopy size={24} />} onClick={copiarPrompt}>
              {copiado ? '¡Copiado!' : 'Copiar instrucciones'}
            </Btn>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              {IAS.map((i) => (
                <a key={i.n} href={i.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                  <Btn size="sm" variant="ghost" icon={<ExternalLink size={16} />}>{i.n}</Btn>
                </a>
              ))}
            </div>
            <button className="small" style={{ marginTop: 12, background: 'none', border: 0, color: 'var(--lav-600)', fontWeight: 700, padding: 0 }} onClick={() => setVerPrompt(true)}>
              Ver qué se envía →
            </button>
          </div>

          <div className="card" style={{ boxShadow: 'none', border: '2px solid var(--lav-100)' }}>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="card-icon" style={{ background: 'var(--lav-500)', color: '#fff', width: 38, height: 38, borderRadius: 12, fontWeight: 800 }}>2</span>
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Pega aquí la respuesta</strong>
            </div>
            <textarea className="textarea" style={{ minHeight: 110 }} placeholder="Pega aquí la respuesta completa..." value={ev.respuestaIA}
              onChange={(e) => update((x) => { x.respuestaIA = e.target.value })} />
            <AnimatePresence>
              {errorIA && <motion.p className="entrar" style={{ color: 'var(--coral-deep)', fontWeight: 700, margin: '8px 0 0' }}>{errorIA}</motion.p>}
            </AnimatePresence>
            <Btn block variant="sun" style={{ marginTop: 12 }} icon={<ClipboardPaste size={22} />} onClick={leerRespuesta} disabled={!ev.respuestaIA.trim()}>
              Usar respuesta como sugerencia
            </Btn>
          </div>
        </div>
      </Card>

      {/* Secciones */}
      <div id="secciones" className="row" style={{ margin: '30px 0 14px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h2 style={{ fontSize: '1.7rem', color: 'var(--lav-800)' }}>Texto del informe</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>Revisa cada sección: acepta una sugerencia o escribe tu propio texto.</p>
        </div>
        {haySugerencias && <Btn variant="mint" icon={<Wand2 size={22} />} onClick={usarTodas}>Usar todas las sugerencias</Btn>}
      </div>

      {SECCIONES_INFORME.map((s, i) => (
        <Seccion key={s.id} i={i} id={s.id} titulo={s.titulo} guia={s.guia}
          valor={ev.informe[s.id]} ia={ev.sugerencias[s.id]} auto={auto[s.id]}
          onChange={(v) => update((e) => { e.informe[s.id] = v })} />
      ))}

      <div className="wizard-nav">
        <Btn variant="ghost" size="lg" icon={<Eye size={24} />} onClick={() => setPreview(true)}>Vista previa</Btn>
        <div className="spacer" />
        <Btn variant="sun" size="lg" icon={<Download size={24} />} onClick={descargarWord} disabled={generando} style={{ flex: '1 1 auto', maxWidth: 380 }}>
          {generando ? 'Generando...' : 'Descargar informe (.docx)'}
        </Btn>
      </div>

      <Modal open={verPrompt} onClose={() => setVerPrompt(false)} title="Instrucciones para copiar" icon={<span className="card-icon" style={{ background: '#fff2cf', color: '#8a5a00' }}><Sparkles size={24} /></span>}>
        <div className="prompt-box">{prompt}</div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <Btn icon={<ClipboardCopy size={22} />} onClick={copiarPrompt}>Copiar</Btn>
        </div>
      </Modal>

      <Modal open={preview} onClose={() => setPreview(false)} title="Vista previa" icon={<span className="card-icon" style={{ background: 'var(--lav-100)', color: 'var(--lav-600)' }}><Eye size={24} /></span>}>
        <VistaPrevia ev={ev} nombre={alumno.nombre} escuela={escuela?.nombre ?? ''} grado={[alumno.grado, alumno.grupo].filter(Boolean).join(' ')} />
      </Modal>
      {node}
    </>
  )
}

function Seccion({ i, id, titulo, guia, valor, ia, auto, onChange }: {
  i: number; id: SeccionId; titulo: string; guia: string; valor: string; ia?: string; auto?: string; onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = `${Math.max(130, el.scrollHeight + 4)}px` }
  }, [valor])
  const [flash, setFlash] = useState(0)
  const usar = (t: string) => { onChange(t); setFlash((f) => f + 1) }

  return (
    <Card className="section-card" delay={0.04 * i}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <h3 style={{ fontSize: '1.3rem', color: 'var(--lav-800)' }}>{titulo}</h3>
          <p className="small muted" style={{ margin: '4px 0 0' }}>{guia}</p>
        </div>
        <AnimatePresence>
          {valor.trim() && (
            <motion.span className="badge mint" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={spring}>
              <Check size={14} strokeWidth={3} /> Listo
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {[{ k: 'ia', t: ia, label: 'Sugerencia recibida', icon: <Bot size={18} /> }, { k: 'auto', t: auto, label: 'Borrador automático (según tus datos)', icon: <Wand2 size={18} /> }]
        .filter((s) => s.t && s.t !== valor)
        .map((s) => (
          <motion.div key={s.k} className="suggest" initial={{ y: 8 }} animate={{ y: 0 }}>
            <div className="suggest-head">{s.icon} {s.label}</div>
            <p>{s.t}</p>
            <div className="row">
              <Btn size="sm" variant="sun" icon={<Check size={18} strokeWidth={3} />} onClick={() => usar(s.t!)}>Aceptar</Btn>
              {valor.trim() && <Btn size="sm" variant="ghost" onClick={() => usar(`${valor.trim()} ${s.t}`)}>Agregar al final</Btn>}
            </div>
          </motion.div>
        ))}

      <label className="final-label label" htmlFor={`sec-${id}`} style={{ marginTop: 14, marginBottom: 8 }}>
        <PenLine size={18} /> Texto final
      </label>
      <motion.div key={flash} animate={flash ? { boxShadow: ['0 0 0 0 rgba(79,209,161,.0)', '0 0 0 8px rgba(79,209,161,.35)', '0 0 0 0 rgba(79,209,161,0)'] } : {}} transition={{ duration: 0.9 }} style={{ borderRadius: 18 }}>
        <textarea id={`sec-${id}`} ref={ref} className="textarea" value={valor} onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe o acepta una sugerencia..." />
      </motion.div>
    </Card>
  )
}

function VistaPrevia({ ev, nombre, escuela, grado }: { ev: Evaluation; nombre: string; escuela: string; grado: string }) {
  const p = (t: string) => <p style={{ margin: '4px 0 12px 28px', textAlign: 'justify' }}>{t || <em style={{ color: '#aaa' }}>(vacío)</em>}</p>
  const h = (t: React.ReactNode) => <p style={{ margin: '10px 0 2px', fontWeight: 700 }}>{t}</p>
  return (
    <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 8, padding: '28px 30px', fontFamily: 'Arial, sans-serif', fontSize: 12.5, color: '#111', boxShadow: '0 10px 30px -12px rgba(0,0,0,.25)' }}>
      <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
        Secretaria de Educación<br />Subsecretaría de Educación Básica<br />Educación Especial Estatal<br />{ev.ciclo}
      </div>
      <div style={{ textAlign: 'center', fontWeight: 700, margin: '18px 0' }}>INFORME DE COMUNICACIÓN VERBAL Y NO VERBAL USAER Y CAM</div>
      <div style={{ lineHeight: 1.7 }}>
        <b>Nombre del alumno(a):</b> {nombre} &nbsp;&nbsp; <b>Edad:</b> {ev.edadTexto}<br />
        <b>Escuela:</b> {escuela} &nbsp;&nbsp; <b>Grado y sección:</b> {grado}<br />
        <b>Lugar y fecha de aplicación:</b> {[ev.lugar, fechaLarga(ev.fecha)].filter(Boolean).join(', ')}<br />
        <b>Instrumento de evaluación aplicado:</b> Evaluación de comunicación verbal
      </div>
      <p style={{ fontWeight: 700, marginTop: 16 }}>Interpretación de los resultados obtenidos en los instrumentos de evaluación verbal y/o no verbal aplicados en el alumno (a), para determinar su situación comunicativa.</p>
      {h('• Estado anatómico y funcional del aparato fonoarticulador.')}{p(ev.informe.fonoarticulador)}
      {h('• Aspectos a considerar en la evaluación de comunicación verbal:')}
      {h(<>• Dimensión de Uso: <u>Componente pragmático</u></>)}{p(ev.informe.pragmatico)}
      {h(<>• Dimensión de Contenido: <u>Componente semántico</u></>)}{p(ev.informe.semantico)}
      {h(<>• Dimensión de Forma: <u>Componente fonológico y morfosintáctico</u></>)}
      {h(<u>Componente morfosintáctico</u>)}{p(ev.informe.morfosintactico)}
      {h(<u>Componente fonológico</u>)}{p(ev.informe.fonologico)}{p(ev.informe.suprasegmentos)}
      {h('• Condición comunicativa en relación a lo expresivo y comprensivo.')}{p(ev.informe.conclusion)}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 40, textAlign: 'center', fontWeight: 700 }}>
        <div>______________________<br /><span style={{ fontWeight: 400 }}>{ev.aplicador}</span><br />Nombre y firma de Especialista</div>
        <div>______________________<br /><span style={{ fontWeight: 400 }}>{ev.maestroGrupo}</span><br />Nombre y firma de docente de grupo</div>
      </div>
    </div>
  )
}
