import { useEffect, useMemo, useState } from 'react'
import logoDis from '../assets/logo-dis-logistica-inteligente.png'
import { splashSoundCheck, splashSoundConfirm, splashSoundWhoosh } from '../lib/splashSounds'
import './OpeningSplash.css'

const LOADING_MESSAGES = [
  'Inicializando sistema...',
  'Conectando ao banco de dados...',
  'Sincronizando estoque...',
  'Conectando WMS...',
  'Carregando informações operacionais...',
  'Preparando ambiente de trabalho...',
  'Carregando dashboard...',
] as const

/** ~9,6 s — ícone mais rápido; barra de progresso ~3,2 s no final */
const DURATION_MS = 9600
const LOADER_AT_MS = 4000
const REDUCED_MOTION_MS = 900

const PHASE_MS = {
  iconBuild: 800,
  dAndCheck: 1800,
  logoReveal: 2800,
  logoHold: 3600,
} as const

type Phase = 0 | 1 | 2 | 3 | 4 | 5

type Props = {
  onComplete: () => void
}

export default function OpeningSplash({ onComplete }: Props) {
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )
  const [phase, setPhase] = useState<Phase>(0)
  const [progress, setProgress] = useState(0)
  const [msgIndex, setMsgIndex] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  const particles = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        top: `${10 + ((i * 13) % 80)}%`,
        size: i % 4 === 0 ? 6 : i % 3 === 0 ? 5 : 4,
        delay: `${(i * 0.14) % 3.2}s`,
        duration: `${2.8 + (i % 6) * 0.22}s`,
        lane: i % 3,
      })),
    [],
  )

  useEffect(() => {
    if (reducedMotion) {
      const t = window.setTimeout(() => {
        setExiting(true)
        window.setTimeout(onComplete, 400)
      }, REDUCED_MOTION_MS)
      return () => window.clearTimeout(t)
    }

    const timers = [
      window.setTimeout(() => setPhase(1), PHASE_MS.iconBuild),
      window.setTimeout(() => {
        setPhase(2)
        splashSoundCheck()
      }, PHASE_MS.dAndCheck),
      window.setTimeout(() => {
        setPhase(3)
        splashSoundWhoosh()
      }, PHASE_MS.logoReveal),
      window.setTimeout(() => {
        setPhase(4)
        splashSoundWhoosh()
      }, PHASE_MS.logoHold),
      window.setTimeout(() => setPhase(5), LOADER_AT_MS),
      window.setTimeout(() => {
        splashSoundConfirm()
        setExiting(true)
        window.setTimeout(onComplete, 680)
      }, DURATION_MS),
    ]

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      if (elapsed < LOADER_AT_MS) {
        setProgress(0)
      } else {
        const loaderDuration = DURATION_MS - LOADER_AT_MS - 350
        const loaderElapsed = elapsed - LOADER_AT_MS
        const t = Math.min(1, loaderElapsed / loaderDuration)
        const eased = 1 - Math.pow(1 - t, 1.4)
        setProgress(Math.min(100, Math.round(eased * 100)))
      }
      if (elapsed < DURATION_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const msgTimer = window.setInterval(() => {
      setMsgVisible(false)
      window.setTimeout(() => {
        setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
        setMsgVisible(true)
      }, 280)
    }, 1100)

    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      clearInterval(msgTimer)
    }
  }, [onComplete, reducedMotion])

  const showIconBuild = phase >= 1 && phase < 3
  const showD = phase >= 1 && phase < 3
  const showLogo = phase >= 3
  const showLogoHold = phase >= 4
  const showLoader = phase >= 5

  return (
    <div
      className={`opening-splash${exiting ? ' opening-splash--exit' : ''}`}
      role="presentation"
      aria-hidden={exiting}
    >
      <div className="opening-splash__vignette" aria-hidden />
      <div className="opening-splash__scanlines" aria-hidden />
      <div className="opening-splash__glow" />
      <div className="opening-splash__glow opening-splash__glow--pulse" aria-hidden />
      <div className="opening-splash__conveyor" aria-hidden>
        <span className="opening-splash__conveyor-line" />
        <span className="opening-splash__conveyor-line opening-splash__conveyor-line--2" />
      </div>

      <div className="opening-splash__particles" aria-hidden>
        {particles.map((p) => (
          <span
            key={p.id}
            className={`opening-splash__particle opening-splash__particle--lane-${p.lane}`}
            style={{
              top: p.top,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            }}
          />
        ))}
      </div>

      <div className="opening-splash__stage">
        <div className={`opening-splash__icon-wrap${showLogoHold ? ' opening-splash__icon-wrap--hold' : ''}`}>
          <div className={`opening-splash__letter-d${showD ? ' opening-splash__letter-d--on' : ''}`} aria-hidden>
            <svg viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="splashDGrad" x1="8" y1="6" x2="112" y2="134" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#fff4c4" />
                  <stop offset="28%" stopColor="#f0d060" />
                  <stop offset="58%" stopColor="#d4af37" />
                  <stop offset="100%" stopColor="#8b6914" />
                </linearGradient>
                <filter id="splashDGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#ffd95c" floodOpacity="0.45" />
                </filter>
              </defs>
              <path
                className="opening-splash__d-shape"
                fill="url(#splashDGrad)"
                fillRule="evenodd"
                filter="url(#splashDGlow)"
                d="M 10 8 L 10 132 L 50 132 C 98 132 104 70 98 70 C 104 70 98 8 50 8 Z M 26 30 L 26 110 L 48 110 C 76 110 80 70 76 70 C 80 70 76 30 48 30 Z"
              />
            </svg>
          </div>
          <div className={`opening-splash__pallet${showIconBuild ? ' opening-splash__pallet--on' : ''}`} />
          <div className={`opening-splash__box${showIconBuild ? ' opening-splash__box--on' : ''}`} />
          <div className={`opening-splash__check${showIconBuild ? ' opening-splash__check--on' : ''}`}>
            <span className="opening-splash__check-burst" aria-hidden />
          </div>
          <img
            className={`opening-splash__logo${showLogo ? ' opening-splash__logo--on' : ''}${showLogoHold ? ' opening-splash__logo--hold' : ''}`}
            src={logoDis}
            alt=""
          />
          <div className={`opening-splash__logo-shine${showLogo ? ' opening-splash__logo-shine--on' : ''}`} />
          <div
            className={`opening-splash__logo-shine opening-splash__logo-shine--second${showLogoHold ? ' opening-splash__logo-shine--on' : ''}`}
            aria-hidden
          />
        </div>
      </div>

      <div className={`opening-splash__loader${showLoader ? ' opening-splash__loader--on' : ''}`}>
        <p
          className={`opening-splash__loader-msg${msgVisible ? ' opening-splash__loader-msg--visible' : ''}`}
        >
          {LOADING_MESSAGES[msgIndex]}
        </p>
        <div className="opening-splash__bar-track" aria-hidden>
          <div className="opening-splash__bar-fill" style={{ width: `${progress}%` }}>
            <span className="opening-splash__bar-shimmer" />
          </div>
        </div>
        <p className="opening-splash__loader-pct">{progress}%</p>
      </div>
    </div>
  )
}
