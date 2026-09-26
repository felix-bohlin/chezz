// State and navigation for the campaign map: #/map opens it full screen, #/map/<elo> a province on it.

import { playMapOpen, playProvince, unlockAudio } from '../audio'
import type { ROUTE } from '../pixel/japan'
import type { ManifestEntry } from '../types/game'

export type Status = 'conquered' | 'contested' | 'next' | 'locked'

export interface Castle {
  elo: number
  status: Status
  win?: ManifestEntry
  games: ManifestEntry[]
  tip: string
  province: (typeof ROUTE)[number]
  x: number
  y: number
}

export const STATE: Record<Status, string> = {
  conquered: '制圧 Conquered',
  contested: '交戦 Under siege',
  next: '次 Next',
  locked: '霧 In the fog',
}

export function openWarMap(elo?: number) {
  void unlockAudio()
  const already = window.location.hash.startsWith('#/map')
  if (elo == null) playMapOpen()
  else if (already) playProvince()
  else {
    playMapOpen()
    setTimeout(playProvince, 700)
  }
  // Mark our own history entries so closing can step back instead of stacking new ones. A province
  // opened from outside gets the map underneath it, so closing the drawer lands back on the map.
  if (!already) history.pushState({ warmap: true }, '', '#/map')
  if (elo != null) navigateMap(elo)
  else window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Shows a province on the open map: replaces an open drawer, or pushes a new entry for it. */
export function navigateMap(elo: number) {
  const hash = `#/map/${elo}`
  if (/^#\/map\/\d+/.test(window.location.hash)) history.replaceState({ warmap: true }, '', hash)
  else history.pushState({ warmap: true }, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function closeTo(hash: string) {
  if ((history.state as { warmap?: boolean } | null)?.warmap) history.back()
  else window.location.replace(hash)
}
