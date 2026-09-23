import { motion } from 'framer-motion'
import {
  DatabaseBackup, Download, FolderCheck, FolderOpen, HardDriveUpload, Lightbulb, RotateCcw, Save, Settings as Gear, Smartphone, UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Btn, Card, CardTitle, PageHead, useConfirm, useToast } from '../components/ui'
import { db, getSettings, hoyISO, type Settings as S } from '../db'
import { descargar } from '../lib/docx'
import { cambiarCarpeta, leerRespaldoDeCarpeta, marcarRestaurado, programarRespaldo, useRespaldo } from '../lib/respaldo'
import { crearPaquete, direccionApp, restaurar } from '../lib/sync'
import { hace } from './Sincronizar'
import { Referentes } from './Wizard'

export default function Settings() {
  const toast = useToast()
  const { confirm, node } = useConfirm()
  const respaldo = useRespaldo()
  const [s, setS] = useState<S | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { getSettings().then(setS) }, [])

  const set = (p: Partial<S>) => setS((x) => {
    const n = { ...x!, ...p }
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { db.settings.put(n); toast('Ajustes guardados') }, 700)
    return n
  })

  async function exportar() {
    descargar(new Blob([JSON.stringify(await crearPaquete())], { type: 'application/json' }), `respaldo-evaluaciones-${hoyISO()}.json`)
    toast('Respaldo descargado')
  }

  async function restaurarDe(obtener: () => Promise<unknown>) {
    try {
      const datos = await obtener()
      if (!datos) throw new Error('No se encontró un respaldo')
      if (!(await confirm('Se reemplazarán TODOS los datos de este equipo por los del respaldo.'))) return
      await restaurar(datos)
      marcarRestaurado()
      setS(await getSettings())
      toast('Respaldo restaurado')
    } catch (e) {
      toast((e as Error).message || 'Archivo inválido', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const esc = window.escritorio

  return (
    <>
      <PageHead eyebrow={<><Gear size={16} /> Ajustes</>} title="Ajustes" sub="Estos datos se usan automáticamente en cada evaluación nueva." />

      <Card>
        <CardTitle icon={<UserRound size={24} />}>Mis datos</CardTitle>
        {s && (
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="esp">Nombre del maestro(a) especialista</label>
              <input id="esp" className="input" value={s.especialista} onChange={(e) => set({ especialista: e.target.value })} placeholder="Aparece como aplicador(a) y en la firma" />
            </div>
            <div className="field">
              <label htmlFor="lug">Lugar habitual de aplicación</label>
              <input id="lug" className="input" value={s.lugar} onChange={(e) => set({ lugar: e.target.value })} placeholder="Ej. Culiacán, Sinaloa" />
            </div>
            <div className="field">
              <label htmlFor="cic">Ciclo escolar</label>
              <input id="cic" className="input" value={s.ciclo} onChange={(e) => set({ ciclo: e.target.value })} placeholder="Ej. 2026-2027" />
            </div>
          </div>
        )}
      </Card>

      {esc && (
        <Card delay={0.05}>
          <CardTitle icon={<FolderCheck size={24} />} color="#dcf7ec" fg="#11704d"
            sub="Cada evaluación, cada informe y una copia completa de todo se guardan aquí automáticamente como archivos.">
            Carpeta de respaldo
          </CardTitle>
          <div className="carpeta-elegida" style={{ marginBottom: 12 }}>
            <FolderCheck size={22} /> <span>{respaldo.carpeta ?? 'Sin carpeta elegida'}</span>
          </div>
          <p className={`small ${respaldo.error ? '' : 'muted'}`} style={{ color: respaldo.error ? 'var(--coral-deep)' : undefined, fontWeight: respaldo.error ? 700 : undefined }}>
            {respaldo.error ?? `Último respaldo: ${hace(respaldo.ultimo ?? undefined)}`}
          </p>
          <div className="row">
            <Btn variant="mint" icon={<FolderOpen size={22} />} onClick={() => esc.respaldo.abrir()} disabled={!respaldo.carpeta}>Abrir carpeta</Btn>
            <Btn variant="ghost" icon={<FolderCheck size={22} />} onClick={async () => cambiarCarpeta(await esc.respaldo.elegir())}>Cambiar carpeta</Btn>
            <Btn variant="ghost" icon={<Save size={22} />} onClick={() => { programarRespaldo(0); toast('Respaldando…') }} disabled={!respaldo.carpeta}>Respaldar ahora</Btn>
            <Btn variant="ghost" icon={<RotateCcw size={22} />} onClick={() => restaurarDe(leerRespaldoDeCarpeta)} disabled={!respaldo.carpeta}>Restaurar desde la carpeta</Btn>
          </div>
        </Card>
      )}

      <Card delay={0.1}>
        <CardTitle icon={<DatabaseBackup size={24} />} color="#e3f4ff" fg="#1d6fa8"
          sub={esc ? 'Guarda una copia en un archivo (por ejemplo en una USB) o restaura una copia anterior.' : 'Tus datos viven en este celular. Guarda una copia en un archivo o restaura una anterior.'}>
          Copia en archivo
        </CardTitle>
        <div className="row">
          <Btn variant="mint" icon={<Download size={22} />} onClick={exportar}>Descargar copia</Btn>
          <Btn variant="ghost" icon={<HardDriveUpload size={22} />} onClick={() => fileRef.current?.click()}>Restaurar copia</Btn>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restaurarDe(async () => JSON.parse(await f.text())) }} />
        </div>
      </Card>

      {esc && s && (
        <Card delay={0.15}>
          <CardTitle icon={<Smartphone size={24} />} color="#fff2cf" fg="#8a5a00"
            sub="Dirección (https) donde está publicada la app para celulares. Se usa en los códigos QR para instalarla y sincronizar.">
            App para celulares
          </CardTitle>
          <input className="input" value={s.appUrl ?? ''} placeholder={direccionApp() || 'https://usuario.github.io/evaluaciones-comunicacion/'}
            onChange={(e) => set({ appUrl: e.target.value.trim() })} />
        </Card>
      )}

      <Card delay={0.2}>
        <CardTitle icon={<Lightbulb size={24} />} color="#fff2cf" fg="#8a5a00">Referentes fonológicos</CardTitle>
        <Referentes />
      </Card>

      <motion.p className="small muted" style={{ textAlign: 'center', marginTop: 30 }}>
        Evaluaciones de Comunicación · versión {__APP_VERSION__}
      </motion.p>
      {node}
    </>
  )
}
