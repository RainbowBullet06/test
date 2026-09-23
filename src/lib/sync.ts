import type { Table } from 'dexie'
import { db, getSettings, sinMarcarFechas, updateSettings, type Evaluation, type School, type Student, type Tombstone } from '../db'

/*
 * Paquete de datos independiente del equipo: las relaciones van por uid (no por id local).
 * Se usa para sincronizar PC <-> celular, para los archivos de respaldo y para "enviar por archivo".
 */
export interface Paquete {
  app: 'evaluaciones-comunicacion'
  version: 2
  generado: string
  equipo: string
  schools: Omit<School, 'id'>[]
  students: (Omit<Student, 'id' | 'schoolId'> & { schoolUid: string })[]
  evaluations: (Omit<Evaluation, 'id' | 'studentId'> & { studentUid: string })[]
  tombstones: Tombstone[]
  especialista?: string
}

type Registro = { id?: number; uid?: string; updatedAt?: number; [campo: string]: unknown }
type Tabla = Table<Registro, number>

export interface Resultado {
  nuevos: number
  actualizados: number
  eliminados: number
}

export function nombreEquipo() {
  if (window.escritorio) return 'Computadora'
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Celular Android'
  return 'Navegador'
}

export async function crearPaquete(): Promise<Paquete> {
  const [schools, students, evaluations, tombstones, cfg] = await Promise.all([
    db.schools.toArray(), db.students.toArray(), db.evaluations.toArray(), db.tombstones.toArray(), getSettings(),
  ])
  const schoolUid = new Map(schools.map((s) => [s.id!, s.uid!]))
  const studentUid = new Map(students.map((s) => [s.id!, s.uid!]))
  return {
    app: 'evaluaciones-comunicacion',
    version: 2,
    generado: new Date().toISOString(),
    equipo: nombreEquipo(),
    schools: schools.map(({ id: _id, ...s }) => s),
    students: students
      .filter((s) => schoolUid.has(s.schoolId))
      .map(({ id: _id, schoolId, ...s }) => ({ ...s, schoolUid: schoolUid.get(schoolId)! })),
    evaluations: evaluations
      .filter((e) => studentUid.has(e.studentId))
      .map(({ id: _id, studentId, ...e }) => ({ ...e, studentUid: studentUid.get(studentId)! })),
    tombstones,
    especialista: cfg.especialista,
  }
}

function validar(p: unknown): Paquete {
  const x = p as Paquete
  if (!x || x.app !== 'evaluaciones-comunicacion' || !Array.isArray(x.schools)) {
    throw new Error('El archivo no contiene datos de esta aplicación.')
  }
  return x
}

/** Une los datos recibidos con los locales. En cada registro gana la versión modificada más recientemente. */
export async function fusionar(entrada: unknown): Promise<Resultado> {
  const p = validar(entrada)
  const r: Resultado = { nuevos: 0, actualizados: 0, eliminados: 0 }

  await sinMarcarFechas(() =>
    db.transaction('rw', [db.schools, db.students, db.evaluations, db.tombstones, db.settings], async () => {
      // 1. Borrados: se aplican si son posteriores a la última modificación local
      const borrados = new Map((await db.tombstones.toArray()).map((t) => [t.uid, t]))
      for (const t of p.tombstones ?? []) {
        const previo = borrados.get(t.uid)
        if (!previo || previo.deletedAt < t.deletedAt) borrados.set(t.uid, t)
      }
      await db.tombstones.bulkPut([...borrados.values()])
      for (const t of borrados.values()) {
        const tabla = db[t.tabla] as unknown as Tabla
        const local = await tabla.where('uid').equals(t.uid).first()
        if (local && (local.updatedAt ?? 0) <= t.deletedAt) {
          await tabla.delete(local.id!)
          r.eliminados++
        }
      }
      const vivo = (u?: string) => !!u && !borrados.has(u)

      // 2. Escuelas, alumnos y evaluaciones (en orden, para resolver relaciones)
      const unir = async (tabla: Tabla, registro: Registro) => {
        const local = await tabla.where('uid').equals(registro.uid!).first()
        if (!local) {
          await tabla.add({ ...registro, id: undefined })
          r.nuevos++
        } else if ((registro.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
          await tabla.put({ ...registro, id: local.id })
          r.actualizados++
        }
      }

      for (const s of p.schools.filter((s) => vivo(s.uid))) await unir(db.schools as unknown as Tabla, s)
      const escuelas = new Map((await db.schools.toArray()).map((s) => [s.uid!, s.id!]))

      for (const { schoolUid, ...a } of p.students.filter((s) => vivo(s.uid))) {
        const schoolId = escuelas.get(schoolUid)
        if (schoolId) await unir(db.students as unknown as Tabla, { ...a, schoolId })
      }
      const alumnos = new Map((await db.students.toArray()).map((s) => [s.uid!, s.id!]))

      for (const { studentUid, ...e } of p.evaluations.filter((e) => vivo(e.uid))) {
        const studentId = alumnos.get(studentUid)
        if (studentId) await unir(db.evaluations as unknown as Tabla, { ...e, studentId })
      }

      // 3. Nombre de la especialista si aún no se capturó en este equipo
      const cfg = await getSettings()
      if (!cfg.especialista && p.especialista) await db.settings.put({ ...cfg, especialista: p.especialista })
    }),
  )
  return r
}

/** Reemplaza todo el contenido local por el de un respaldo (restauración). */
export async function restaurar(entrada: unknown) {
  const p = validar(entrada)
  await db.transaction('rw', [db.schools, db.students, db.evaluations, db.tombstones], async () => {
    await Promise.all([db.schools.clear(), db.students.clear(), db.evaluations.clear(), db.tombstones.clear()])
  })
  return fusionar(p)
}

/* ---------------- Compresión (para el enlace de respaldo de la conexión) ---------------- */

export async function comprimir(texto: string): Promise<string> {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))
  const bytes = new Uint8Array(await new Response(flujo).arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function descomprimir(b64: string): Promise<string> {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(flujo).text()
}

/* ---------------- Lado PC: atender solicitudes que llegan por el servidor local ---------------- */

export function atenderSolicitudesDelCelular(alTerminar: (r: Resultado, equipo: string) => void) {
  const esc = window.escritorio
  if (!esc) return () => {}
  return esc.sync.alSolicitar(async ({ id, paquete }) => {
    try {
      const texto = paquete.comprimido ? await descomprimir(paquete.cuerpo) : paquete.cuerpo
      const recibido = validar(JSON.parse(texto))
      const r = await fusionar(recibido)
      const propio = JSON.stringify(await crearPaquete())
      await esc.sync.responder({ id, paquete: paquete.comprimido ? await comprimir(propio) : propio })
      await updateSettings({ ultimaSync: Date.now() })
      alTerminar(r, recibido.equipo)
    } catch (e) {
      await esc.sync.responder({ id, error: (e as Error).message })
    }
  })
}

/* ---------------- Lado celular: conectarse a la PC ---------------- */

export interface DestinoPC {
  pc: string // http://192.168.x.x:puerto
  t: string // código secreto de la sesión
}

export function leerCodigoQR(texto: string): DestinoPC | null {
  try {
    const u = new URL(texto.trim())
    const q = new URLSearchParams(u.hash.includes('?') ? u.hash.slice(u.hash.indexOf('?') + 1) : u.search)
    const pc = q.get('pc')
    const t = q.get('t')
    if (pc && t && /^https?:\/\//.test(pc)) return { pc, t }
  } catch {
    /* no es una dirección */
  }
  return null
}

/**
 * Intenta la conexión directa (Chrome pide permiso de "red local" la primera vez).
 * Devuelve el resultado, o null si el navegador bloqueó la conexión y hay que usar el puente.
 */
export async function sincronizarDirecto(d: DestinoPC): Promise<Resultado | null> {
  const opciones = { targetAddressSpace: 'local' } as RequestInit
  let resp: Response
  try {
    resp = await fetch(`${d.pc}/sync`, {
      ...opciones,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': d.t },
      body: JSON.stringify(await crearPaquete()),
    })
  } catch {
    return null // bloqueada por el navegador o sin red: se intenta el puente
  }
  if (resp.status === 403) throw new Error('El código ya venció. En la computadora presiona "Conectar celular" otra vez.')
  if (!resp.ok) throw new Error(await resp.text())
  const r = await fusionar(await resp.json())
  await updateSettings({ ultimaSync: Date.now() })
  return r
}

/** Alternativa: navega a la página puente de la PC llevando los datos en el enlace. */
export async function sincronizarConPuente(d: DestinoPC) {
  const datos = await comprimir(JSON.stringify(await crearPaquete()))
  const volver = location.origin + location.pathname
  const frag = new URLSearchParams({ t: d.t, d: datos, volver })
  location.href = `${d.pc}/puente#${frag.toString()}`
}

/** Al volver del puente, la app recibe los datos de la PC en el enlace. */
export async function recibirDePuente(r: string): Promise<Resultado> {
  const res = await fusionar(JSON.parse(await descomprimir(r)))
  await updateSettings({ ultimaSync: Date.now() })
  return res
}

/**
 * Dirección pública (HTTPS) donde está publicada la app para celulares.
 * - En el celular es la propia dirección de la página.
 * - En la PC viene de Ajustes o de la variable VITE_APP_URL al compilar.
 */
export function direccionApp(appUrl?: string): string {
  const propia = !window.escritorio && location.protocol.startsWith('http') ? location.origin + location.pathname : ''
  const d = (appUrl || import.meta.env.VITE_APP_URL || propia || '').trim()
  return d && !d.endsWith('/') && !d.endsWith('.html') ? `${d}/` : d
}

export function enlaceSincronizar(appUrl: string, pc: string, t: string) {
  return `${appUrl}#/sincronizar?${new URLSearchParams({ pc, t }).toString()}`
}
