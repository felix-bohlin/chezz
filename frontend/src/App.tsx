import { useEffect, useState } from 'react'
import { Dojo } from './components/Dojo'
import { IntroScroll } from './components/IntroScroll'
import { Live, useLive } from './components/Live'
import { Replay } from './components/Replay'
import { Scenery } from './components/Scenery'
import { loadManifest } from './lib/data'
import { introUnseen } from './story/intro'
import type { Manifest } from './types/game'

const POLL_MS = 15000

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [intro, setIntro] = useState(introUnseen)
  const hash = useHashRoute()
  const live = useLive(5000)
  const liveGameCount = live?.active ? null : live?.lastGameId

  useEffect(() => {
    let alive = true
    const load = () =>
      loadManifest().then(
        (m) => alive && (setManifest(m), setError(null)),
        (e) => alive && setError(String(e)),
      )
    load()
    const t = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [liveGameCount])

  const route = hash.match(/^#\/game\/(\d+)(?:\/(\d+))?/)
  const gameId = route?.[1]
  const initialPly = route?.[2] ? Number(route[2]) : 0
  const isLive = hash.startsWith('#/live')
  const entry = gameId ? manifest?.games.find((g) => g.id === gameId) : undefined
  const openGame = (id: string) => (window.location.hash = `#/game/${id}`)

  return (
    <>
      <Scenery />
      <div className="app">
        <nav className="topbar">
          <a className="brand" href="#/">
            <span className="brand-mon">棋</span> CHEZZ
          </a>
          <div className="topbar-actions">
            <button className="px-btn" onClick={() => setIntro(true)} aria-label="Play the intro scroll">
              巻 Intro
            </button>
            {live?.active && !isLive && (
              <a className="px-btn live-btn" href="#/live">
                <span className="live-dot" /> LIVE vs {live.stockfishElo}
              </a>
            )}
            {(gameId || isLive) && (
              <a className="px-btn" href="#/">
                ◀ Campaign
              </a>
            )}
          </div>
        </nav>
        <main>
          {isLive ? (
            <Live />
          ) : (
            <>
              {error && !manifest && <div className="px-panel notice">Could not load games/manifest.json: {error}</div>}
              {manifest && !gameId && <Dojo manifest={manifest} live={live} onOpen={openGame} />}
              {manifest &&
                gameId &&
                (entry ? (
                  <Replay key={entry.id} entry={entry} initialPly={initialPly} />
                ) : (
                  <div className="px-panel notice">Battle #{gameId} not found.</div>
                ))}
            </>
          )}
        </main>
        {intro && <IntroScroll onClose={() => setIntro(false)} />}
        <footer className="footer">Rust engine vs Stockfish 19 · every battle saved, every move replayable</footer>
      </div>
    </>
  )
}
