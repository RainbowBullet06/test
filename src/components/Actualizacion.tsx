import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Btn, spring } from './ui'

/** Aviso de nueva versión de la app (solo en la versión web / celular). */
export default function Actualizacion() {
  const { needRefresh: [hayNueva], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // revisa si hay versión nueva cada hora mientras la app esté abierta
      if (registro) setInterval(() => registro.update().catch(() => {}), 60 * 60 * 1000)
    },
  })
  return (
    <AnimatePresence>
      {hayNueva && (
        <motion.div className="aviso-actualizacion" initial={{ y: 80 }} animate={{ y: 0 }} transition={spring}>
          <RefreshCw size={22} />
          <span>Hay una versión nueva de la app.</span>
          <Btn size="sm" variant="sun" onClick={() => updateServiceWorker(true)}>Actualizar</Btn>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
