import {
  AUDITIVA, EDADES_FONEMAS, ELEMENTOS, FONEMAS, MODO_ARTICULACION, ORGANOS, PUNTO_ARTICULACION,
  RESPIRACION, SEMANTICO, VOZ, type Fonema,
} from '../data/formato'
import type { Informe, TestData } from '../db'

const ALT = { O: 'omisión', S: 'sustitución', D: 'distorsión' } as const

export interface ErrorFonema {
  f: Fonema
  emision: string
  alteraciones: string[]
  // rango de edad en que se adquiere, según la tabla del formato (ej. "4 a 4.5")
  edadAdquisicion: string | null
}

export function erroresFonologicos(t: TestData): ErrorFonema[] {
  return FONEMAS.filter((f) => t.fonemas[f.n]?.estado === 'error').map((f) => {
    const r = t.fonemas[f.n]
    const alteraciones = (['inicial', 'media', 'final'] as const)
      .filter((p) => r[p])
      .map((p) => `${ALT[r[p] as 'O' | 'S' | 'D']} en posición ${p}`)
    const g = EDADES_FONEMAS.find((x) => x.sonidos.includes(f.fonema))
    return { f, emision: r.emision, alteraciones, edadAdquisicion: g?.edad ?? null }
  })
}

export function fonemasAfectados(errores: ErrorFonema[]) {
  return [...new Set(errores.map((e) => e.f.fonema))]
}

export function clasificar(fonemas: string[]) {
  const punto = PUNTO_ARTICULACION.filter((p) => p.fonemas.some((f) => fonemas.includes(f))).map((p) => p.nombre)
  const modo = MODO_ARTICULACION.filter((m) => m.fonemas.some((f) => fonemas.includes(f))).map((m) => m.nombre)
  return { punto, modo }
}

export function progresoPrueba(t: TestData) {
  const partes = [
    ORGANOS.filter((o) => t.organos[o]?.funcional).length / ORGANOS.length,
    t.respiracion ? 1 : 0,
    VOZ.filter((v) => t.voz[v.id]).length / VOZ.length,
    AUDITIVA.filter((a) => t.auditiva[a.id]?.valor).length / AUDITIVA.length,
    t.muestraOral.trim() ? 1 : 0,
    Object.values(t.elementos).some(Boolean) || Object.values(t.oraciones).some(Boolean) ? 1 : 0,
    SEMANTICO.filter((s) => t.semantico[s.id]?.resultado).length / SEMANTICO.length,
    FONEMAS.filter((f) => t.fonemas[f.n]?.estado).length / FONEMAS.length,
  ]
  return partes.reduce((a, b) => a + b, 0) / partes.length
}

const lista = (xs: string[]) =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`

// ---- Borradores automáticos (sin IA) a partir de los datos capturados ----

export function borradorAutomatico(t: TestData, sexo: 'F' | 'M'): Partial<Informe> {
  const al = sexo === 'F' ? 'la alumna' : 'el alumno'
  const out: Partial<Informe> = {}

  // Aparato fonoarticulador
  const conDificultad = ORGANOS.filter((o) => t.organos[o]?.funcional === 'no')
  const obs = ORGANOS.filter((o) => t.organos[o]?.obs.trim()).map((o) => `${o.toLowerCase()}: ${t.organos[o].obs.trim()}`)
  const resp = RESPIRACION.find((r) => r.id === t.respiracion)
  let fono = conDificultad.length
    ? `En exploración de aparato fonoarticulador ${al} presenta dificultad en el movimiento funcional de ${lista(conDificultad.map((o) => o.toLowerCase()))}`
    : `En exploración de aparato fonoarticulador ${al} no tiene dificultad en movimiento funcional de órganos`
  if (obs.length) fono += ` (${obs.join('; ')})`
  fono += resp ? `, su respiración es de tipo ${resp.nombre.toLowerCase()}.` : '.'
  out.fonoarticulador = fono

  // Suprasegmentos
  const v = t.voz
  if (VOZ.some((x) => v[x.id])) {
    const partes = [
      v.intensidad && `volumen ${v.intensidad.toLowerCase()}`,
      v.timbre && `timbre ${v.timbre.toLowerCase()}`,
      v.ritmo && `ritmo ${v.ritmo.toLowerCase()}`,
      v.tono && `tono ${v.tono.toLowerCase()}`,
    ].filter(Boolean) as string[]
    out.suprasegmentos = `En suprasegmentos de voz tiene ${partes.join(', ')}.`
  }

  // Morfosintáctico
  const els = ELEMENTOS.filter((e) => t.elementos[e]).map((e) => e.toLowerCase())
  const ors = (['Simples', 'Complejas'] as const).filter((o) => t.oraciones[o]).map((o) => o.toLowerCase())
  if (els.length || ors.length) {
    let m = 'En la estructura gramatical'
    if (els.length) m += ` utiliza ${lista(els)}`
    if (ors.length) m += `${els.length ? ',' : ''} construye oraciones ${lista(ors)}`
    out.morfosintactico = m + '.'
  }

  // Fonológico
  const evaluados = FONEMAS.filter((f) => t.fonemas[f.n]?.estado).length
  if (evaluados) {
    const errores = erroresFonologicos(t)
    if (!errores.length) {
      out.fonologico = 'No presenta trastornos fonológicos de punto y modo de articulación.'
    } else {
      const afect = fonemasAfectados(errores)
      const { punto, modo } = clasificar(afect)
      const detalle = errores
        .map((e) => `/${e.f.fonema}/ en "${e.f.palabra.toLowerCase()}"${e.emision ? ` (dice "${e.emision}")` : ''}`)
        .join(', ')
      let txt = `Presenta alteraciones fonológicas en los fonemas ${afect.map((f) => `/${f}/`).join(', ')}: ${detalle}.`
      if (punto.length || modo.length)
        txt += ` Corresponden al punto de articulación ${lista(punto.map((p) => p.toLowerCase()))} y al modo ${lista(modo.map((m) => m.toLowerCase()))}.`
      out.fonologico = txt
    }
  }
  return out
}

// ---- Resumen de la prueba en texto (sin datos personales) para el prompt ----

export function resumenPrueba(t: TestData): string {
  const L: string[] = []
  const siNo = (x: string | null) => (x === 'si' ? 'Sí' : x === 'no' ? 'No' : 'Sin registrar')

  L.push('### 1. Aparato fonoarticulador (características funcionales)')
  for (const o of ORGANOS) {
    const r = t.organos[o]
    L.push(`- ${o}: funcional = ${siNo(r.funcional)}${r.obs.trim() ? ` | Observación: ${r.obs.trim()}` : ''}`)
  }
  const resp = RESPIRACION.find((r) => r.id === t.respiracion)
  L.push(`- Tipo de respiración: ${resp ? `${resp.nombre} (${resp.desc})` : 'Sin registrar'}`)

  L.push('', '### 2. Suprasegmentos de voz')
  for (const v of VOZ) L.push(`- ${v.nombre}: ${t.voz[v.id] || 'Sin registrar'}`)

  L.push('', '### 3. Discriminación auditiva')
  for (const a of AUDITIVA) {
    const r = t.auditiva[a.id]
    L.push(`- ${a.texto}: ${siNo(r.valor)}${r.obs.trim() ? ` | Observación: ${r.obs.trim()}` : ''}`)
  }

  L.push('', '### 4. Aspecto pragmático (muestra oral espontánea, transcripción literal)')
  L.push(t.muestraOral.trim() ? `"${t.muestraOral.trim()}"` : 'Sin registrar')

  L.push('', '### 5. Aspecto morfosintáctico')
  const enun = t.enunciados.filter((e) => e.trim())
  L.push(enun.length ? 'Enunciados rescatados de la muestra:' : 'Enunciados: sin registrar')
  enun.forEach((e, i) => L.push(`  ${i + 1}. "${e.trim()}"`))
  const ors = Object.entries(t.oraciones).filter(([, v]) => v).map(([k]) => k)
  const els = ELEMENTOS.filter((e) => t.elementos[e])
  L.push(`- Tipos de oración utilizados: ${ors.length ? ors.join(', ') : 'ninguno marcado'}`)
  L.push(`- Elementos morfosintácticos utilizados: ${els.length ? els.join(', ') : 'ninguno marcado'}`)
  const noUsa = ELEMENTOS.filter((e) => !t.elementos[e])
  if (els.length) L.push(`- Elementos NO observados: ${noUsa.join(', ')}`)

  L.push('', '### 6. Aspecto semántico (tarjetas fonológicas y semánticas)')
  for (const s of SEMANTICO) {
    const r = t.semantico[s.id]
    let q = s.pregunta
    r.objetos.forEach((o) => (q = q.replace('___', o.trim() || '___')))
    const res = r.resultado ? (r.resultado === 'correcta' ? 'CORRECTA' : 'INCORRECTA') : 'sin calificar'
    L.push(`- ${q} → Respuesta: "${r.respuesta.trim() || '—'}" (${res})`)
  }
  if (t.notasSemantico.trim()) L.push(`- Notas adicionales: ${t.notasSemantico.trim()}`)

  L.push('', '### 7. Aspecto fonológico (articulación; O=omisión, S=sustitución, D=distorsión)')
  const evaluados = FONEMAS.filter((f) => t.fonemas[f.n]?.estado)
  const errores = erroresFonologicos(t)
  L.push(`- Palabras evaluadas: ${evaluados.length} de ${FONEMAS.length}; con error: ${errores.length}`)
  for (const e of errores) {
    L.push(
      `  - ${e.f.n}. /${e.f.fonema}/ "${e.f.palabra}" → emite "${e.emision || '?'}"` +
        (e.alteraciones.length ? ` (${e.alteraciones.join(', ')})` : '') +
        (e.edadAdquisicion ? ` [se adquiere aprox. de ${e.edadAdquisicion} años]` : ''),
    )
  }
  if (errores.length) {
    const { punto, modo } = clasificar(fonemasAfectados(errores))
    L.push(`- Punto de articulación de los fonemas afectados: ${punto.join(', ') || '—'}`)
    L.push(`- Modo de articulación de los fonemas afectados: ${modo.join(', ') || '—'}`)
  }
  L.push(`- Referencia de edades aproximadas para articular: ${EDADES_FONEMAS.map((e) => `${e.edad} años: ${e.sonidos.join(', ')}`).join(' | ')}`)

  if (t.conclusiones.trim()) {
    L.push('', '### 8. Conclusiones anotadas por el especialista en la prueba')
    L.push(t.conclusiones.trim())
  }
  return L.join('\n')
}
