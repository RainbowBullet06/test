import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
// la plantilla se incrusta en el bundle para funcionar sin servidor (Electron file:// y PWA offline)
import plantillaUrl from '../assets/plantilla-informe.docx?inline'
import type { Evaluation, School, Student } from '../db'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function fechaLarga(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

export async function generarInforme(ev: Evaluation, alumno: Student, escuela: School | undefined): Promise<Blob> {
  const buf = await (await fetch(plantillaUrl)).arrayBuffer()
  const doc = new Docxtemplater(new PizZip(buf), { paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  const grado = [alumno.grado, alumno.grupo].filter(Boolean).join(' ')
  doc.render({
    ciclo: ev.ciclo,
    nombre: alumno.nombre,
    edad: ev.edadTexto,
    escuela: escuela?.nombre ?? '',
    grado,
    lugar_fecha: [ev.lugar, fechaLarga(ev.fecha)].filter(Boolean).join(', '),
    instrumento: 'Evaluación de comunicación verbal',
    firma_especialista: ev.aplicador,
    firma_docente: ev.maestroGrupo,
    ...ev.informe,
  })
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    compression: 'DEFLATE',
  })
}

export function nombreArchivo(alumno: Student, ev: Evaluation) {
  const limpio = alumno.nombre.replace(/[\\/:*?"<>|]/g, '').trim()
  return `Informe comunicación - ${limpio} - ${ev.fecha}.docx`
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
