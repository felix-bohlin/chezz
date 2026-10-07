// Weather sounds: a looping rain hiss whose volume follows the rain, and thunder.

import { getGraph } from './engine'
import { taiko } from './instruments'

let rainGain: GainNode | null = null

function ensureRain(): GainNode | null {
  if (rainGain) return rainGain
  const g = getGraph()
  if (!g || g.ctx.state !== 'running') return null
  const ctx = g.ctx
  const len = ctx.sampleRate * 2
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < len; i++) {
      // Slightly brown noise with sparse "drops".
      last = last * 0.6 + (Math.random() * 2 - 1) * 0.4
      d[i] = last + (Math.random() < 0.0008 ? (Math.random() - 0.5) * 1.5 : 0)
    }
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  const band = ctx.createBiquadFilter()
  band.type = 'lowpass'
  band.frequency.value = 2400
  rainGain = ctx.createGain()
  rainGain.gain.value = 0
  src.connect(band).connect(rainGain).connect(g.sfx)
  src.start()
  return rainGain
}

/** 0–1. Called every frame; cheap. */
export function setRain(level: number, enabled: boolean): void {
  const gain = level > 0.01 || rainGain ? ensureRain() : null
  if (!gain) return
  const g = getGraph()!
  gain.gain.setTargetAtTime(enabled ? level * 0.35 : 0, g.ctx.currentTime, 0.5)
}

export function playThunder(): void {
  const g = getGraph()
  if (!g || g.ctx.state !== 'running') return
  const t = g.ctx.currentTime + 0.6 + Math.random() * 1.2
  taiko(g, g.sfx, t, 0.9, 0.35)
  taiko(g, g.sfx, t + 0.25, 0.6, 0.3)
  taiko(g, g.sfx, t + 0.6, 0.4, 0.28)
}
