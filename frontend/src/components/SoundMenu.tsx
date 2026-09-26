import { useEffect, useRef, useState } from 'react'
import { getSettings, setSettings, unlockAudio, type AudioSettings } from '../audio'

/** Header sound control: one click toggles the menu; inside, mute plus music and effects volume. */
export function SoundMenu() {
  const [open, setOpen] = useState(false)
  const [s, setS] = useState<AudioSettings>(getSettings)
  const root = useRef<HTMLDivElement>(null)

  const update = (patch: Partial<AudioSettings>) => {
    setSettings(patch)
    setS(getSettings())
    void unlockAudio()
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const slider = (key: 'music' | 'sfx', label: string) => (
    <label className="sound-row">
      <span>{label}</span>
      <input
        className="px-range"
        type="range"
        min={0}
        max={100}
        value={Math.round(s[key] * 100)}
        disabled={s.muted}
        onChange={(e) => update({ [key]: Number(e.target.value) / 100 })}
      />
    </label>
  )

  return (
    <div className="sound-menu" ref={root}>
      <button
        className={`px-btn${s.muted ? ' sound-off' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={s.muted ? 'Sound is off: open sound menu' : 'Sound is on: open sound menu'}
      >
        {s.muted ? '♪ Muted' : '♪ Sound'}
      </button>
      {open && (
        <div className="px-panel sound-pop" role="group" aria-label="Sound settings">
          <button
            className={`px-chip sound-toggle${s.muted ? '' : ' active'}`}
            onClick={() => update({ muted: !s.muted })}
            aria-pressed={!s.muted}
          >
            {s.muted ? '♪ Sound off' : '♪ Sound on'}
          </button>
          {slider('music', 'Music')}
          {slider('sfx', 'Effects')}
        </div>
      )}
    </div>
  )
}
