// The temple bell: a long, low gong on the sfx bus.

import { getGraph } from './engine'
import { gong } from './instruments'

export function playBell(): void {
  const g = getGraph()
  if (!g || g.ctx.state !== 'running') return
  gong(g, g.sfx, g.ctx.currentTime + 0.05, 0.6, 72, 7)
}
