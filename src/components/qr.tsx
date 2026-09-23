import { motion } from 'framer-motion'
import jsQR from 'jsqr'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'

/** Código QR grande, con marco lavanda. */
export function QR({ texto, tam = 260 }: { texto: string; tam?: number }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    QRCode.toDataURL(texto, { width: tam * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b1a4d', light: '#ffffff' } })
      .then(setSrc)
      .catch(() => setSrc(''))
  }, [texto, tam])
  return (
    <motion.div className="qr-marco" style={{ width: tam + 28 }} initial={{ scale: 0.8, rotate: -4 }}
      animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
      {src && <img src={src} width={tam} height={tam} alt="Código QR" />}
    </motion.div>
  )
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

/** Escáner con la cámara trasera. Usa el lector nativo del navegador si existe, si no jsQR. */
export function EscanerQR({ alLeer, alError }: { alLeer: (texto: string) => void; alError: (msg: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const listo = useRef(false)

  useEffect(() => {
    let flujo: MediaStream | null = null
    let cuadro = 0
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
    const detector = BD ? new BD({ formats: ['qr_code'] }) : null

    const revisar = async () => {
      const v = video.current
      if (!v || listo.current) return
      if (v.readyState >= 2) {
        try {
          let texto: string | undefined
          if (detector) {
            texto = (await detector.detect(v))[0]?.rawValue
          } else if (ctx) {
            const escala = Math.min(1, 640 / v.videoWidth)
            lienzo.width = v.videoWidth * escala
            lienzo.height = v.videoHeight * escala
            ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height)
            texto = jsQR(ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, lienzo.width, lienzo.height)?.data
          }
          if (texto) {
            listo.current = true
            navigator.vibrate?.(80)
            alLeer(texto)
            return
          }
        } catch {
          /* se reintenta en el siguiente cuadro */
        }
      }
      cuadro = requestAnimationFrame(revisar)
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        flujo = s
        if (video.current) {
          video.current.srcObject = s
          video.current.play().catch(() => {})
        }
        cuadro = requestAnimationFrame(revisar)
      })
      .catch(() => alError('No se pudo abrir la cámara. Revisa que la app tenga permiso de usarla.'))

    return () => {
      cancelAnimationFrame(cuadro)
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [alLeer, alError])

  return (
    <div className="escaner">
      <video ref={video} playsInline muted />
      <div className="escaner-guia"><motion.span className="escaner-linea" animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} /></div>
    </div>
  )
}
