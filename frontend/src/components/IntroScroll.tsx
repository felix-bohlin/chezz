import { useCallback, useEffect, useRef, useState } from 'react'
import { playSituation, setTension, startMusic, stopMusic } from '../audio'
import { paintPanel } from '../pixel/intro'
import { hermitNosebleedUrl, hermitUrl } from '../pixel/render'
import { HISTORY_NOTE, INTRO_PANELS, markIntroSeen, type IntroPanel } from '../story/intro'
import { SENSEI_NAME } from '../story/sensei'

/** Time on each panel: enough to read the narration slowly, never under 9 s. */
const panelMs = (p: IntroPanel) => Math.max(9000, 5000 + 75 * p.narration.length)

function Panel({ panel, active }: { panel: IntroPanel; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (canvas.current) paintPanel(canvas.current, panel.art)
  }, [panel.art])
  return (
    <figure className={`intro-panel intro-${panel.art}`}>
      <canvas ref={canvas} className="intro-art" aria-hidden="true" />
      <figcaption>
        <div className="intro-caption">{panel.caption}</div>
        {/* Master Roshi tells the story: his sprite beside a speech bubble holding the narration. */}
        <div className="intro-narrator">
          <div className="intro-roshi">
            <img src={hermitUrl()} alt={SENSEI_NAME} draggable={false} />
            {/* Mounted only while the panel is on screen, so the spurt plays when you arrive, not off-stage. */}
            {panel.bleed && active && (
              <>
                <img className="roshi-bleed" src={hermitNosebleedUrl()} alt="" draggable={false} />
                <span className="roshi-drop d1" />
                <span className="roshi-drop d2" />
                <span className="roshi-drop d3" />
                <span className="roshi-drop d4" />
              </>
            )}
          </div>
          <blockquote className="intro-bubble">
            <span className="intro-bubble-who">{SENSEI_NAME}</span>
            <p className="intro-narration">{panel.narration}</p>
          </blockquote>
        </div>
      </figcaption>
    </figure>
  )
}

export function IntroScroll({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [showHistory, setShowHistory] = useState(false)
  const last = INTRO_PANELS.length - 1

  const close = useCallback(() => {
    markIntroSeen()
    stopMusic()
    onClose()
  }, [onClose])
  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last])

  // The calm night march plays under the scroll (starts once the browser allows audio).
  useEffect(() => {
    setTension(0)
    startMusic()
    return () => stopMusic()
  }, [])

  useEffect(() => {
    if (index === last) {
      playSituation('game_start')
      return
    }
    if (showHistory) return
    const t = setTimeout(() => setIndex((i) => i + 1), panelMs(INTRO_PANELS[index]))
    return () => clearTimeout(t)
  }, [index, last, showHistory])

  // Capture phase so the replay's own arrow/space shortcuts don't fire underneath.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        if (index === last) close()
        else go(index + 1)
      }
      else if (e.key === 'ArrowLeft') go(index - 1)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, last, go, close])

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true" aria-label="The Night of Iga — intro">
      <div className="intro-scroll">
        <div className="intro-roller intro-roller-left" aria-hidden="true" />
        <div className="intro-paper">
          <div className="intro-title">
            <span className="intro-title-kanji">伊賀越え</span> The Night of Iga
          </div>
          <div className="intro-window">
            <div className="intro-strip" style={{ transform: `translateX(${-index * 100}%)` }}>
              {INTRO_PANELS.map((p, i) => (
                <div key={p.art} className="intro-slot" aria-hidden={i !== index}>
                  <Panel panel={p} active={i === index} />
                </div>
              ))}
            </div>
          </div>
          <div className="intro-nav">
            <button className="px-btn" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous panel">
              ◀
            </button>
            <div className="intro-dots" aria-label={`Panel ${index + 1} of ${INTRO_PANELS.length}`}>
              {INTRO_PANELS.map((p, i) => (
                <button
                  key={p.art}
                  className={`intro-dot${i === index ? ' active' : ''}`}
                  onClick={() => go(i)}
                  aria-label={`Go to panel ${i + 1}: ${p.caption}`}
                />
              ))}
            </div>
            {index === last ? (
              <button className="px-btn px-btn-primary" onClick={close}>
                Enter the night ▶
              </button>
            ) : (
              <button className="px-btn" onClick={() => go(index + 1)} aria-label="Next panel">
                ▶
              </button>
            )}
          </div>
          <div className="intro-footer">
            <button className="intro-link" onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
              {showHistory ? '▾' : '▸'} History vs legend
            </button>
            <button className="intro-link" onClick={close}>
              Skip ✕
            </button>
          </div>
          {showHistory && <p className="intro-history">{HISTORY_NOTE}</p>}
        </div>
        <div className="intro-roller intro-roller-right" aria-hidden="true" />
      </div>
    </div>
  )
}
