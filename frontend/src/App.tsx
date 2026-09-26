import { useEffect, useState } from 'react'
import { About } from './components/About'
import { Dojo } from './components/Dojo'
import { IntroScroll } from './components/IntroScroll'
import { Keynote } from './components/Keynote'
import { Live, useLive } from './components/Live'
import { Replay } from './components/Replay'
import { Scenery } from './components/Scenery'
import { SoundMenu } from './components/SoundMenu'
import { Story } from './components/Story'
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
  const isAbout = hash.startsWith('#/about')
  const isStory = hash.startsWith('#/story')
  const keynote = hash.match(/^#\/keynote(?:\/(\d+))?/)
  const mapRoute = hash.match(/^#\/map(?:\/(\d+))?/)
  const isHome = !gameId && !isLive && !isAbout && !isStory && !keynote
  const entry = gameId ? manifest?.games.find((g) => g.id === gameId) : undefined
  const openGame = (id: string) => (window.location.hash = `#/game/${id}`)

  return (
    <>
      <Scenery />
      <div className="app">
        <nav className="topbar">
          <a className="brand" href="#/" aria-label="Campaign: back to the home page" aria-current={isHome ? 'page' : undefined}>
            <span className="brand-mon">棋</span> CHEZZ<span className="brand-war">: TOTAL WAR</span>
          </a>
          <div className="topbar-actions">
            {live?.active && (
              <a className="px-btn live-btn" href="#/live" aria-current={isLive ? 'page' : undefined}>
                <span className="live-dot" /> LIVE vs {live.stockfishElo}
              </a>
            )}
            <button className="px-btn" onClick={() => setIntro(true)} aria-label="Play the intro scroll">
              巻 Intro
            </button>
            <a className="px-btn" href="#/story" aria-current={isStory ? 'page' : undefined} aria-label="The story: the night of Iga and its cast">
              物 Story
            </a>
            <a className="px-btn" href="#/keynote" aria-current={keynote ? 'page' : undefined} aria-label="Keynote: how we built this with Claude Code">
              講 Keynote
            </a>
            <a className="px-btn" href="#/about" aria-current={isAbout ? 'page' : undefined} aria-label="Fair play: how every move is verified legal">
              正 Fair play
            </a>
            <SoundMenu />
          </div>
        </nav>
        <main>
          {isLive ? (
            <Live />
          ) : isAbout ? (
            <About manifest={manifest} />
          ) : isStory ? (
            <Story onIntro={() => setIntro(true)} />
          ) : keynote ? (
            <Keynote manifest={manifest} slide={Number(keynote[1] ?? 0)} />
          ) : (
            <>
              {error && !manifest && <div className="px-panel notice">Could not load games/manifest.json: {error}</div>}
              {manifest && !gameId && <Dojo
                  manifest={manifest}
                  live={live}
                  onOpen={openGame}
                  map={{ open: !!mapRoute, elo: mapRoute?.[1] ? Number(mapRoute[1]) : undefined }}
                />}
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
