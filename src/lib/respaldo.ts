import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, type Evaluation, type School, type Student } from '../db'
import { crearPaquete, type Paquete } from './sync'

/*
 * Respaldo automático en archivos (solo app de escritorio).
 * Cada vez que cambian los datos se escriben en la carpeta elegida:
 *   respaldo-completo.json                    → todo, para restaurar
 *   respaldos/respaldo-AAAA-MM-DD.json        → una copia por día (últimos 60 días)
 *   Evaluaciones/<Escuela>/<Alumno>/...json   → cada evaluación por separado
 *   Evaluaciones/<Escuela>/<Alumno>/...docx   → cada informe descargado
 */

export const ARCHIVO_COMPLETO = 'respaldo-completo.json'

export interface EstadoRespaldo {
  disponible: boolean // true solo en la app de escritorio
  carpeta: string | null
  ultimo: number | null
  error: string | null
  // la carpeta tiene un respaldo con datos pero este equipo está vacío (p. ej. tras reinstalar)
  restaurable: { evaluaciones: number; alumnos: number; fecha: string } | null
}

let estado: EstadoRespaldo = { disponible: !!window.escritorio, carpeta: null, ultimo: null, error: null, restaurable: null }
const oyentes = new Set<() => void>()
const emitir = (p: Partial<EstadoRespaldo>) => {
  estado = { ...estado, ...p }
  oyentes.forEach((f) => f())
}

export function useRespaldo() {
  return useSyncExternalStore(
    (f) => (oyentes.add(f), () => oyentes.delete(f)),
    () => estado,
  )
}

const limpiar = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sin nombre'

function carpetaAlumno(a: Student | undefined, e: School | undefined) {
  return `Evaluaciones/${limpiar(e?.nombre ?? 'Sin escuela')}/${limpiar(a?.nombre ?? 'Sin alumno')}`
}

export function rutaEvaluacion(ev: Evaluation, a?: Student, e?: School) {
  return `${carpetaAlumno(a, e)}/${ev.fecha} - Evaluación (${(ev.uid ?? String(ev.id)).slice(0, 6)}).json`
}

export function rutaInforme(ev: Evaluation, a?: Student, e?: School) {
  return `${carpetaAlumno(a, e)}/${ev.fecha} - Informe (${(ev.uid ?? String(ev.id)).slice(0, 6)}).docx`
}

const escritos = new Map<string, number>() // uid de evaluación -> updatedAt ya respaldado
let temporizador: number | undefined
let enCurso: Promise<void> | null = null
let iniciado = false

async function respaldarAhora() {
  const esc = window.escritorio
  if (!esc) return
  const carpeta = await esc.respaldo.carpeta()
  if (!carpeta) {
    emitir({ carpeta: null, error: 'No hay carpeta de respaldo. Elige una en Ajustes.' })
    return
  }
  try {
    const paquete = await crearPaquete()
    // Protección: un equipo recién instalado (sin datos ni borrados) nunca reemplaza un respaldo con datos
    if (!paquete.schools.length && !paquete.students.length && !paquete.evaluations.length && !paquete.tombstones.length) {
      const previo = await leerRespaldoDeCarpeta().catch(() => null)
      if (previo && (previo.students?.length || previo.evaluations?.length)) {
        emitir({
          carpeta,
          error: null,
          restaurable: { evaluaciones: previo.evaluations?.length ?? 0, alumnos: previo.students?.length ?? 0, fecha: previo.generado },
        })
        return
      }
    }
    const texto = JSON.stringify(paquete, null, 1)
    await esc.respaldo.escribir(ARCHIVO_COMPLETO, texto)
    await esc.respaldo.escribir(`respaldos/respaldo-${new Date().toLocaleDateString('en-CA')}.json`, texto)
    await esc.respaldo.rotar('respaldos', 60)

    const [evals, alumnos, escuelas] = await Promise.all([db.evaluations.toArray(), db.students.toArray(), db.schools.toArray()])
    const alumnoPorId = new Map(alumnos.map((a) => [a.id!, a]))
    const escuelaPorId = new Map(escuelas.map((e) => [e.id!, e]))
    for (const ev of evals) {
      if (escritos.get(ev.uid!) === ev.updatedAt) continue
      const a = alumnoPorId.get(ev.studentId)
      const e = a ? escuelaPorId.get(a.schoolId) : undefined
      const { id: _i, studentId: _s, ...evaluacion } = ev
      await esc.respaldo.escribir(
        rutaEvaluacion(ev, a, e),
        JSON.stringify({ tipo: 'evaluacion', guardado: new Date().toISOString(), escuela: e?.nombre, alumno: a, evaluacion }, null, 1),
      )
      escritos.set(ev.uid!, ev.updatedAt)
    }
    emitir({ carpeta, ultimo: Date.now(), error: null, restaurable: null })
  } catch (err) {
    emitir({ carpeta, error: `No se pudo guardar el respaldo: ${(err as Error).message}` })
  }
}

/** Programa un respaldo (se agrupan los cambios que ocurren seguidos). */
export function programarRespaldo(esperaMs = 1200) {
  if (!window.escritorio) return
  clearTimeout(temporizador)
  temporizador = window.setTimeout(() => {
    enCurso = (enCurso ?? Promise.resolve()).then(respaldarAhora)
  }, esperaMs)
}

/** Empieza a vigilar la base de datos. Se llama una vez al abrir la app de escritorio. */
export function iniciarRespaldoAutomatico() {
  if (!window.escritorio || iniciado) return
  iniciado = true
  window.escritorio.respaldo.carpeta().then((carpeta) => emitir({ carpeta }))
  // huella de los datos: cambia cuando se agrega, modifica o borra cualquier registro
  liveQuery(async () => {
    const tablas = await Promise.all([db.schools.toArray(), db.students.toArray(), db.evaluations.toArray()])
    const borrados = await db.tombstones.count()
    return [...tablas.map((t) => `${t.length}:${Math.max(0, ...t.map((x) => x.updatedAt ?? 0))}`), borrados].join('|')
  }).subscribe({ next: () => programarRespaldo() })
}

/** Guarda el informe .docx junto a la evaluación, en la carpeta de respaldo. */
export async function guardarInformeEnCarpeta(blob: Blob, ev: Evaluation, a: Student, e?: School) {
  const esc = window.escritorio
  if (!esc || !(await esc.respaldo.carpeta())) return null
  const ruta = rutaInforme(ev, a, e)
  await esc.respaldo.escribir(ruta, new Uint8Array(await blob.arrayBuffer()))
  return ruta
}

export async function leerRespaldoDeCarpeta(): Promise<Paquete | null> {
  const txt = await window.escritorio?.respaldo.leer(ARCHIVO_COMPLETO)
  return txt ? JSON.parse(txt) : null
}

export async function cambiarCarpeta(carpeta: string | null) {
  if (!carpeta) return
  escritos.clear() // se reescriben todas las evaluaciones en la nueva carpeta
  emitir({ carpeta, error: null, restaurable: null })
  programarRespaldo(0)
}

/** Vuelve a revisar la carpeta (p. ej. después de restaurar). */
export function marcarRestaurado() {
  escritos.clear()
  emitir({ restaurable: null })
  programarRespaldo(0)
}
