import Dexie, { type Table } from 'dexie'
import { AUDITIVA, FONEMAS, ORGANOS, SEMANTICO, type SeccionId } from './data/formato'

/*
 * Cada registro tiene:
 *  - id: número local (solo para rutas dentro de este equipo)
 *  - uid: identificador global, igual en la PC y en el celular
 *  - updatedAt: última modificación (gana el cambio más reciente al sincronizar)
 */

export interface School {
  id?: number
  uid?: string
  nombre: string
  cct?: string
  tipo?: string
  localidad?: string
  turno?: string
  createdAt: number
  updatedAt?: number
}

export interface Student {
  id?: number
  uid?: string
  schoolId: number
  nombre: string
  sexo: 'F' | 'M'
  fechaNacimiento?: string
  edad?: string
  grado: string
  grupo?: string
  maestroGrupo?: string
  notas?: string
  createdAt: number
  updatedAt?: number
}

export type SiNo = 'si' | 'no' | null
export type Alteracion = '' | 'O' | 'S' | 'D'

export interface FonemaRegistro {
  estado: 'bien' | 'error' | null
  emision: string
  inicial: Alteracion
  media: Alteracion
  final: Alteracion
}

export interface TestData {
  organos: Record<string, { funcional: SiNo; obs: string }>
  respiracion: string
  voz: Record<string, string>
  auditiva: Record<string, { valor: SiNo; obs: string }>
  muestraOral: string
  enunciados: string[]
  oraciones: Record<string, boolean>
  elementos: Record<string, boolean>
  semantico: Record<string, { objetos: string[]; respuesta: string; resultado: 'correcta' | 'incorrecta' | null }>
  notasSemantico: string
  fonemas: Record<number, FonemaRegistro>
  conclusiones: string
}

export type Informe = Record<SeccionId, string>

export interface Evaluation {
  id?: number
  uid?: string
  studentId: number
  createdAt: number
  updatedAt: number
  fecha: string
  lugar: string
  aplicador: string
  maestroGrupo: string
  ciclo: string
  edadTexto: string
  paso: number
  test: TestData
  respuestaIA: string
  sugerencias: Partial<Informe>
  informe: Informe
  estado: 'en-proceso' | 'prueba-lista' | 'terminada'
}

export interface Tombstone {
  uid: string
  tabla: 'schools' | 'students' | 'evaluations'
  deletedAt: number
}

export interface Settings {
  id: 'main'
  especialista: string
  lugar: string
  ciclo: string
  configurado?: boolean
  // dirección pública de la app para celulares (se usa en los códigos QR)
  appUrl?: string
  ultimaSync?: number
}

export const uid = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >>> 0
        return (c === 'x' ? r : (r & 3) | 8).toString(16)
      })

class EvalDB extends Dexie {
  schools!: Table<School, number>
  students!: Table<Student, number>
  evaluations!: Table<Evaluation, number>
  settings!: Table<Settings, string>
  tombstones!: Table<Tombstone, string>

  constructor() {
    super('evaluaciones-comunicacion')
    this.version(1).stores({
      schools: '++id, nombre, createdAt',
      students: '++id, schoolId, nombre, createdAt',
      evaluations: '++id, studentId, updatedAt, estado',
      settings: 'id',
    })
    this.version(2)
      .stores({
        schools: '++id, &uid, nombre, createdAt',
        students: '++id, &uid, schoolId, nombre, createdAt',
        evaluations: '++id, &uid, studentId, updatedAt, estado',
        settings: 'id',
        tombstones: 'uid',
      })
      .upgrade(async (tx) => {
        for (const t of ['schools', 'students', 'evaluations']) {
          await tx.table(t).toCollection().modify((r: { uid?: string; updatedAt?: number; createdAt?: number }) => {
            r.uid ??= uid()
            r.updatedAt ??= r.createdAt ?? Date.now()
          })
        }
      })
  }
}

export const db = new EvalDB()

// Al fusionar datos de otro equipo se conservan sus fechas originales
let conservandoFechas = false
export async function sinMarcarFechas<T>(fn: () => Promise<T>): Promise<T> {
  conservandoFechas = true
  try {
    return await fn()
  } finally {
    conservandoFechas = false
  }
}

for (const t of [db.schools, db.students, db.evaluations] as Table<{ uid?: string; updatedAt?: number }, number>[]) {
  t.hook('creating', (_pk, obj) => {
    obj.uid ??= uid()
    if (!conservandoFechas || !obj.updatedAt) obj.updatedAt = Date.now()
  })
  t.hook('updating', (mods) => (conservandoFechas || 'updatedAt' in mods ? undefined : { updatedAt: Date.now() }))
}

async function marcarBorrado(tabla: Tombstone['tabla'], uids: (string | undefined)[]) {
  const deletedAt = Date.now()
  await db.tombstones.bulkPut(uids.filter(Boolean).map((u) => ({ uid: u!, tabla, deletedAt })))
}

export async function borrarEvaluacion(id: number) {
  await db.transaction('rw', [db.evaluations, db.tombstones], async () => {
    const e = await db.evaluations.get(id)
    await marcarBorrado('evaluations', [e?.uid])
    await db.evaluations.delete(id)
  })
}

export async function borrarAlumno(id: number) {
  await db.transaction('rw', [db.students, db.evaluations, db.tombstones], async () => {
    const a = await db.students.get(id)
    const evs = await db.evaluations.where('studentId').equals(id).toArray()
    await marcarBorrado('evaluations', evs.map((e) => e.uid))
    await marcarBorrado('students', [a?.uid])
    await db.evaluations.where('studentId').equals(id).delete()
    await db.students.delete(id)
  })
}

export async function borrarEscuela(id: number) {
  await db.transaction('rw', [db.schools, db.students, db.evaluations, db.tombstones], async () => {
    const e = await db.schools.get(id)
    const alumnos = await db.students.where('schoolId').equals(id).toArray()
    const ids = alumnos.map((a) => a.id!)
    const evs = await db.evaluations.where('studentId').anyOf(ids).toArray()
    await marcarBorrado('evaluations', evs.map((x) => x.uid))
    await marcarBorrado('students', alumnos.map((a) => a.uid))
    await marcarBorrado('schools', [e?.uid])
    await db.evaluations.where('studentId').anyOf(ids).delete()
    await db.students.bulkDelete(ids)
    await db.schools.delete(id)
  })
}

export function cicloActual(d = new Date()): string {
  // el ciclo escolar en México inicia en agosto
  const y = d.getFullYear()
  return d.getMonth() >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? { id: 'main', especialista: '', lugar: '', ciclo: cicloActual() }
}

export async function updateSettings(p: Partial<Settings>) {
  await db.settings.put({ ...(await getSettings()), ...p })
}

export function emptyTest(): TestData {
  return {
    organos: Object.fromEntries(ORGANOS.map((o) => [o, { funcional: null, obs: '' }])),
    respiracion: '',
    voz: { intensidad: '', timbre: '', ritmo: '', tono: '' },
    auditiva: Object.fromEntries(AUDITIVA.map((a) => [a.id, { valor: null, obs: '' }])),
    muestraOral: '',
    enunciados: ['', '', ''],
    oraciones: {},
    elementos: {},
    semantico: Object.fromEntries(
      SEMANTICO.map((s) => [s.id, { objetos: Array(s.huecos).fill(''), respuesta: '', resultado: null }]),
    ),
    notasSemantico: '',
    fonemas: Object.fromEntries(
      FONEMAS.map((f) => [f.n, { estado: null, emision: '', inicial: '', media: '', final: '' }]),
    ),
    conclusiones: '',
  }
}

export function emptyInforme(): Informe {
  return {
    fonoarticulador: '', pragmatico: '', semantico: '', morfosintactico: '',
    fonologico: '', suprasegmentos: '', conclusion: '',
  }
}

export function calcularEdad(fechaNacimiento?: string, ref = new Date()): number | null {
  if (!fechaNacimiento) return null
  const n = new Date(fechaNacimiento + 'T00:00:00')
  if (isNaN(n.getTime())) return null
  let e = ref.getFullYear() - n.getFullYear()
  const m = ref.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--
  return e
}

export function edadDeAlumno(s: Student, ref = new Date()): string {
  const e = calcularEdad(s.fechaNacimiento, ref)
  if (e !== null) return `${e} años`
  return s.edad ? (/\d$/.test(s.edad.trim()) ? `${s.edad.trim()} años` : s.edad) : ''
}

export const hoyISO = () => new Date().toLocaleDateString('en-CA')

export async function crearEvaluacion(s: Student): Promise<number> {
  const cfg = await getSettings()
  const now = Date.now()
  return db.evaluations.add({
    studentId: s.id!,
    createdAt: now,
    updatedAt: now,
    fecha: hoyISO(),
    lugar: cfg.lugar,
    aplicador: cfg.especialista,
    maestroGrupo: s.maestroGrupo ?? '',
    ciclo: cfg.ciclo || cicloActual(),
    edadTexto: edadDeAlumno(s),
    paso: 0,
    test: emptyTest(),
    respuestaIA: '',
    sugerencias: {},
    informe: emptyInforme(),
    estado: 'en-proceso',
  })
}
