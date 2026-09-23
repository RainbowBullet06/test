import { SECCIONES_INFORME, type SeccionId } from '../data/formato'
import type { Informe, TestData } from '../db'
import { resumenPrueba } from './analisis'

interface PromptInput {
  test: TestData
  sexo: 'F' | 'M'
  edadTexto: string
  grado: string
  // textos que NUNCA deben salir en el prompt (nombre, escuela, maestros...)
  privados: string[]
}

const quitarAcentos = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')

const NO_PRIVADAS = new Set(['del', 'los', 'las', 'san', 'santa', 'escuela', 'primaria', 'jardin', 'ninos', 'colegio',
  'instituto', 'centro', 'maestro', 'maestra', 'profesor', 'profesora', 'turno', 'matutino', 'vespertino'])

/** Reemplaza cualquier aparición de nombres propios privados por [NOMBRE]. */
export function anonimizar(texto: string, privados: string[]): string {
  const palabras = new Set<string>()
  for (const p of privados) {
    for (const w of p.split(/[\s,.]+/)) {
      const n = quitarAcentos(w.toLowerCase())
      if (n.length >= 3 && !NO_PRIVADAS.has(n)) palabras.add(n)
    }
  }
  if (!palabras.size) return texto
  return texto.replace(/[\p{L}]+/gu, (w) => (palabras.has(quitarAcentos(w.toLowerCase())) ? '[NOMBRE]' : w))
}

export function generarPrompt(i: PromptInput): string {
  const al = i.sexo === 'F' ? 'la alumna' : 'el alumno'
  const secciones = SECCIONES_INFORME.map(
    (s) => `- "${s.id}": ${s.titulo}. Qué analizar: ${s.guia}\n  Ejemplo de redacción: "${s.ejemplo}"`,
  ).join('\n')

  const texto = `Actúa como especialista en comunicación y lenguaje de Educación Especial (USAER / CAM) en México.
A partir de los resultados de una "Evaluación de Comunicación Verbal" aplicada a ${al} (sin datos personales), redacta las secciones del "Informe de Comunicación Verbal y No Verbal".

## Datos generales (anónimos)
- Sexo: ${i.sexo === 'F' ? 'femenino (usar "la alumna")' : 'masculino (usar "el alumno")'}
- Edad: ${i.edadTexto || 'no especificada'}
- Grado escolar: ${i.grado || 'no especificado'}

## Resultados de la prueba
${resumenPrueba(anonimizarTest(i.test, i.privados))}

## Instrucciones de redacción
1. Escribe en español, en tercera persona, con lenguaje técnico pero claro, como lo haría la especialista.
2. Sé breve: de 1 a 4 oraciones por sección, en un solo párrafo, sin viñetas.
3. Basa cada afirmación SOLO en los datos anteriores. No inventes resultados. Si un aspecto no se registró, indícalo brevemente.
4. Nunca incluyas nombres; refiérete siempre como "${al}".
5. En "fonologico" menciona los fonemas afectados, el tipo de alteración (omisión, sustitución o distorsión) y su punto y modo de articulación; considera si son esperados para su edad.
6. En "conclusion" describe la condición comunicativa en lo expresivo y/o comprensivo, y sugiere la derivación a un equipo multidisciplinario solo si los datos lo justifican.

## Secciones a redactar
${secciones}

## Formato de respuesta (MUY IMPORTANTE)
Responde ÚNICAMENTE con un bloque JSON válido, sin texto adicional, con exactamente estas claves:
\`\`\`json
{
${SECCIONES_INFORME.map((s) => `  "${s.id}": "..."`).join(',\n')}
}
\`\`\``

  return texto
}

/** Anonimiza solo el texto libre que capturó el especialista (no las palabras de la prueba). */
function anonimizarTest(t: TestData, privados: string[]): TestData {
  const a = (x: string) => anonimizar(x, privados)
  return {
    ...t,
    muestraOral: a(t.muestraOral),
    enunciados: t.enunciados.map(a),
    notasSemantico: a(t.notasSemantico),
    conclusiones: a(t.conclusiones),
    organos: Object.fromEntries(Object.entries(t.organos).map(([k, v]) => [k, { ...v, obs: a(v.obs) }])),
    auditiva: Object.fromEntries(Object.entries(t.auditiva).map(([k, v]) => [k, { ...v, obs: a(v.obs) }])),
    semantico: Object.fromEntries(Object.entries(t.semantico).map(([k, v]) => [k, { ...v, respuesta: a(v.respuesta) }])),
  }
}

const CLAVES = SECCIONES_INFORME.map((s) => s.id) as SeccionId[]

/** Interpreta la respuesta pegada del LLM. Tolera texto extra, comillas tipográficas y comas finales. */
export function interpretarRespuesta(raw: string): Partial<Informe> {
  const texto = raw.trim()
  if (!texto) throw new Error('Pega la respuesta del asistente de IA.')

  const inicio = texto.indexOf('{')
  const fin = texto.lastIndexOf('}')
  if (inicio !== -1 && fin > inicio) {
    let json = texto.slice(inicio, fin + 1)
    const intentos = [
      json,
      (json = json.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')),
      json.replace(/\r?\n/g, ' '),
    ]
    for (const j of intentos) {
      try {
        const obj = JSON.parse(j)
        const out: Partial<Informe> = {}
        for (const k of CLAVES) {
          const v = obj[k] ?? obj[k.toUpperCase()]
          if (typeof v === 'string' && v.trim()) out[k] = v.trim()
        }
        if (Object.keys(out).length) return out
      } catch {
        /* siguiente intento */
      }
    }
  }

  // Alternativa: secciones con encabezados ("pragmatico: ...", "### Semántico" ...)
  const norm = (s: string) => quitarAcentos(s.toLowerCase())
  const out: Partial<Informe> = {}
  const lineas = texto.split(/\r?\n/)
  let actual: SeccionId | null = null
  for (const l of lineas) {
    const cab = norm(l).replace(/[#*"_]/g, '').trim()
    const k = CLAVES.find((c) => cab.startsWith(c) || cab.startsWith(norm(SECCIONES_INFORME.find((s) => s.id === c)!.titulo)))
    if (k) {
      actual = k
      const resto = l.split(/:(.+)/)[1]
      out[k] = (resto ?? '').replace(/^[\s"]+|[\s",]+$/g, '')
    } else if (actual && l.trim()) {
      out[actual] = `${out[actual] ?? ''} ${l.trim()}`.trim()
    }
  }
  if (!Object.keys(out).length)
    throw new Error('No se pudo leer la respuesta. Asegúrate de copiar todo el bloque que te entregó la IA.')
  return out
}
