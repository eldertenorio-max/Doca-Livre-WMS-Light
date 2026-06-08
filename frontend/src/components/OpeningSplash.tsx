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

const DURATION_MS = 5600
const REDUCED_MOTION_MS = 900

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
  const [exiting, setExiting] = useState(false)

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        top: `${12 + ((i * 17) % 76)}%`,
        delay: `${(i * 0.11) % 2.2}s`,
        duration: `${2.2 + (i % 5) * 0.15}s`,
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
      window.setTimeout(() => setPhase(1), 1000),
      window.setTimeout(() => {
        setPhase(2)
        splashSoundCheck()
      }, 2000),
      window.setTimeout(() => {
        setPhase(3)
        splashSoundWhoosh()
      }, 3000),
      window.setTimeout(() => {
        setPhase(4)
        splashSoundWhoosh()
      }, 4000),
      window.setTimeout(() => setPhase(5), 4800),
      window.setTimeout(() => {
        splashSoundConfirm()
        setExiting(true)
        window.setTimeout(onComplete, 520)
      }, DURATION_MS),
    ]

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const pct = Math.min(100, Math.round((elapsed / (DURATION_MS - 400)) * 100))
      setProgress(pct)
      if (elapsed < DURATION_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 780)

    return () => {
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      clearInterval(msgTimer)
    }
  }, [onComplete, reducedMotion])

  const showIconBuild = phase >= 1 && phase < 3
  const showD = phase >= 2 && phase < 3
  const showLogo = phase >= 3
  const showLoader = phase >= 5

  return (
    <div
      className={`opening-splash${exiting ? ' opening-splash--exit' : ''}`}
      role="presentation"
      aria-hidden={exiting}
    >
      <div className="opening-splash__glow" />
      <div className="opening-splash__particles" aria-hidden>
        {particles.map((p) => (
          <span
            key={p.id}
            className="opening-splash__particle"
            style={{ top: p.top, animationDelay: p.delay, animationDuration: p.duration }}
          />
        ))}
      </div>

      <div className="opening-splash__stage">
        <div className="opening-splash__icon-wrap">
          <div className={`opening-splash__pallet${showIconBuild ? ' opening-splash__pallet--on' : ''}`} />
          <div className={`opening-splash__box${showIconBuild ? ' opening-splash__box--on' : ''}`} />
          <div className={`opening-splash__check${showIconBuild ? ' opening-splash__check--on' : ''}`} />
          <div className={`opening-splash__d-ring${showD ? ' opening-splash__d-ring--on' : ''}`} />
          <img
            className={`opening-splash__logo${showLogo ? ' opening-splash__logo--on' : ''}`}
            src={logoDis}
            alt=""
          />
          <div className={`opening-splash__logo-shine${showLogo ? ' opening-splash__logo-shine--on' : ''}`} />
        </div>
      </div>

      <div className={`opening-splash__loader${showLoader ? ' opening-splash__loader--on' : ''}`}>
        <p className="opening-splash__loader-msg">{LOADING_MESSAGES[msgIndex]}</p>
        <div className="opening-splash__bar-track" aria-hidden>
          <div className="opening-splash__bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}
