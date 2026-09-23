import { AnimatePresence, animate, motion, useMotionValue, useTransform, type HTMLMotionProps } from 'framer-motion'
import { Check, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export const spring = { type: 'spring', stiffness: 420, damping: 28 } as const
export const softSpring = { type: 'spring', stiffness: 220, damping: 24 } as const

/* ---------------- Fondo con blobs flotantes ---------------- */
export function Backdrop() {
  const blobs = [
    { c: '#c9b3ff', s: 420, x: '70%', y: '-8%', d: 18 },
    { c: '#ffe3a3', s: 260, x: '-6%', y: '60%', d: 22 },
    { c: '#b8ecff', s: 300, x: '85%', y: '70%', d: 26 },
    { c: '#e7d9ff', s: 360, x: '30%', y: '85%', d: 20 },
  ]
  return (
    <div className="backdrop" aria-hidden>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="blob"
          style={{ width: b.s, height: b.s, left: b.x, top: b.y, background: b.c }}
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.08, 0.96, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="dots" />
      <div className="grain" />
    </div>
  )
}

/* ---------------- Mascota "Lala" ---------------- */
type Mood = 'happy' | 'wave' | 'cheer' | 'think' | 'sleep'

export function Mascot({ size = 120, mood = 'happy' }: { size?: number; mood?: Mood }) {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    let t: number
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true)
        window.setTimeout(() => setBlink(false), 140)
        loop()
      }, 2200 + Math.random() * 2600)
    }
    loop()
    return () => clearTimeout(t)
  }, [])
  const eyesClosed = blink || mood === 'sleep'
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="-10 -10 220 220"
      animate={mood === 'cheer' ? { y: [0, -16, 0], rotate: [0, -6, 6, 0] } : { y: [0, -6, 0] }}
      transition={{ duration: mood === 'cheer' ? 0.9 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="mz" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#efe7ff" />
        </linearGradient>
      </defs>
      <ellipse cx="100" cy="186" rx="52" ry="8" fill="#43237f" opacity=".14" />
      {/* cuerpo burbuja */}
      <path d="M40 40h120a28 28 0 0 1 28 28v62a28 28 0 0 1-28 28H96l-34 26v-26H40a28 28 0 0 1-28-28V68a28 28 0 0 1 28-28z"
        fill="url(#mz)" stroke="#43237f" strokeWidth="6" strokeLinejoin="round" />
      {/* mejillas */}
      <ellipse cx="58" cy="118" rx="12" ry="8" fill="#ffb3c7" opacity=".7" />
      <ellipse cx="142" cy="118" rx="12" ry="8" fill="#ffb3c7" opacity=".7" />
      {/* ojos */}
      {eyesClosed ? (
        <g stroke="#43237f" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M66 96q10 8 20 0" />
          <path d="M114 96q10 8 20 0" />
        </g>
      ) : mood === 'cheer' ? (
        <g stroke="#43237f" strokeWidth="6" strokeLinecap="round" fill="none">
          <path d="M66 100q10-14 20 0" />
          <path d="M114 100q10-14 20 0" />
        </g>
      ) : (
        <g fill="#43237f">
          <circle cx="76" cy="96" r="10" />
          <circle cx="124" cy="96" r="10" />
          <circle cx="79" cy="92" r="3.5" fill="#fff" />
          <circle cx="127" cy="92" r="3.5" fill="#fff" />
        </g>
      )}
      {/* boca */}
      {mood === 'think' ? (
        <path d="M88 128h24" stroke="#43237f" strokeWidth="6" strokeLinecap="round" />
      ) : mood === 'cheer' ? (
        <path d="M80 120q20 26 40 0z" fill="#43237f" stroke="#43237f" strokeWidth="4" strokeLinejoin="round" />
      ) : (
        <path d="M84 122q16 16 32 0" stroke="#43237f" strokeWidth="6" strokeLinecap="round" fill="none" />
      )}
      {/* brazo que saluda */}
      {(mood === 'wave' || mood === 'cheer') && (
        <g className="mascot-arm">
          <path d="M182 92q16-16 10-36" stroke="#43237f" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="192" cy="52" r="9" fill="#ffc857" stroke="#43237f" strokeWidth="5" />
        </g>
      )}
      {/* estrellita */}
      <path className="mascot-star" d="M170 20l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z"
        fill="#ffc857" stroke="#43237f" strokeWidth="3" strokeLinejoin="round" />
      {mood === 'think' && (
        <g fill="#a584f5">
          <motion.circle cx="30" cy="30" r="6" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity }} />
          <motion.circle cx="16" cy="14" r="4" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.3 }} />
        </g>
      )}
    </motion.svg>
  )
}

/* ---------------- Garabatos decorativos ---------------- */
export function Star({ size = 28, color = '#ffc857', className, style }: { size?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <motion.svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24"
      animate={{ rotate: [0, 15, -10, 0], scale: [1, 1.12, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
      <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 16.9 5.9 20.4l1.5-6.8L2.2 9l6.9-.7z" fill={color} stroke="#43237f" strokeWidth="1.6" strokeLinejoin="round" />
    </motion.svg>
  )
}

export function Squiggle({ width = 120, color = '#a584f5', className, style }: { width?: number; color?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} width={width} height={width * 0.2} viewBox="0 0 120 24" fill="none">
      <motion.path d="M2 12c10-12 20 12 30 0s20 12 30 0 20 12 30 0 20 12 26 0" stroke={color} strokeWidth="4" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: 'easeInOut' }} />
    </svg>
  )
}

/* ---------------- Botón ---------------- */
type BtnProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'sun' | 'mint' | 'coral' | 'sky' | 'ghost' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  block?: boolean
  icon?: ReactNode
}

export function Btn({ variant = 'primary', size = 'md', block, icon, className = '', children, ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'primary' && `btn-${variant}`, size !== 'md' && `btn-${size}`, block && 'btn-block', className]
    .filter(Boolean).join(' ')
  return (
    <motion.button className={cls} whileHover={{ y: -2 }} transition={spring} type="button" {...rest}>
      {icon}
      {children as ReactNode}
    </motion.button>
  )
}

/* ---------------- Chips de opción ---------------- */
export function Chips<T extends string>({
  options, value, onChange, tone, size, labels,
}: {
  options: readonly T[]
  value: T | null | ''
  onChange: (v: T | null) => void
  tone?: (v: T) => 'yes' | 'no' | undefined
  size?: 'lg'
  labels?: Partial<Record<T, ReactNode>>
}) {
  return (
    <div className="chips" role="radiogroup">
      {options.map((o) => {
        const on = value === o
        return (
          <motion.button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            className={`chip ${size === 'lg' ? 'chip-lg' : ''} ${on ? 'on' : ''} ${tone?.(o) ?? ''}`}
            onClick={() => onChange(on ? null : o)}
            whileTap={{ scale: 0.92 }}
            animate={on ? { scale: [1, 1.08, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {on && <motion.span className="chip-bg" layoutId={undefined} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={spring} />}
            {on && (
              <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
                <Check size={18} strokeWidth={3.5} />
              </motion.span>
            )}
            <span>{labels?.[o] ?? o}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <motion.button type="button" role="checkbox" aria-checked={on} className={`chip ${on ? 'on' : ''}`} onClick={() => onChange(!on)}
      whileTap={{ scale: 0.92 }} animate={on ? { scale: [1, 1.08, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}>
      {on && <motion.span className="chip-bg" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={spring} />}
      {on && (
        <motion.span initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
          <Check size={18} strokeWidth={3.5} />
        </motion.span>
      )}
      <span>{children}</span>
    </motion.button>
  )
}

/* ---------------- Tarjeta con aparición ---------------- */
export function Card({ children, className = '', delay = 0, style }: { children: ReactNode; className?: string; delay?: number; style?: React.CSSProperties }) {
  return (
    <motion.section className={`card ${className}`} style={style} initial={{ opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...softSpring, delay }}>
      {children}
    </motion.section>
  )
}

export function CardTitle({ icon, color = 'var(--lav-100)', fg = 'var(--lav-600)', children, sub }: {
  icon?: ReactNode; color?: string; fg?: string; children: ReactNode; sub?: ReactNode
}) {
  return (
    <>
      <h2 className="card-title">
        {icon && <span className="card-icon" style={{ background: color, color: fg }}>{icon}</span>}
        {children}
      </h2>
      {sub && <p className="card-sub">{sub}</p>}
    </>
  )
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <motion.header className="page-head" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={softSpring}>
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </motion.header>
  )
}

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
export const riseItem = {
  hidden: { opacity: 0, y: 18, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: softSpring },
}

/* ---------------- Número animado ---------------- */
export function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v))
  const [n, setN] = useState(0)
  useEffect(() => {
    const c = animate(mv, value, { duration: 1.1, ease: 'easeOut' })
    const u = rounded.on('change', setN)
    return () => { c.stop(); u() }
  }, [value, mv, rounded])
  return <>{n}</>
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title: ReactNode; icon?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="modal-bg" onClick={onClose} />
          <motion.div className="modal" role="dialog" aria-modal initial={{ y: 60, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 40, scale: 0.96, opacity: 0 }} transition={spring}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <h2 style={{ flex: 1 }}>{icon}{title}</h2>
              <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={22} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------------- Toasts ---------------- */
interface ToastMsg { id: number; text: string; kind: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} className={`toast ${t.kind}`} layout initial={{ y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0, scale: 0.9 }} transition={spring}>
              <span className="t-ico">{t.kind === 'ok' ? <Check size={20} strokeWidth={3} /> : <CircleAlert size={20} />}</span>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  )
}

/* ---------------- Confirmación ---------------- */
export function useConfirm() {
  const [state, setState] = useState<{ text: string; resolve: (v: boolean) => void } | null>(null)
  const confirm = (text: string) => new Promise<boolean>((resolve) => setState({ text, resolve }))
  const close = (v: boolean) => { state?.resolve(v); setState(null) }
  const node = (
    <Modal open={!!state} onClose={() => close(false)} title="¿Confirmas esta acción?">
      <p className="muted" style={{ marginTop: 0 }}>{state?.text}</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
        <Btn variant="ghost" onClick={() => close(false)}>Cancelar</Btn>
        <Btn variant="coral" onClick={() => close(true)}>Sí, continuar</Btn>
      </div>
    </Modal>
  )
  return { confirm, node }
}

export const AVATAR_COLORS = ['#8a63e8', '#ff7e79', '#4fd1a1', '#69c3ff', '#f2a93b', '#c46be0']
export function avatarColor(seed: string | number) {
  const s = String(seed)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
export function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}
