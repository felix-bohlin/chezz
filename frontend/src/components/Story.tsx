import { playSituation, unlockAudio } from '../audio'
import { spriteUrl } from '../pixel/render'
import { CAST } from '../story/cast'
import { HISTORY_NOTE } from '../story/intro'
import linesJson from '../story/lines.json'
import { ARMOR, DISPLAY_NAME, type DialogueLine, type Situation } from '../story/types'

const LINES = linesJson as DialogueLine[]
const byId = new Map(LINES.map((l) => [l.id, l]))
const SITUATIONS = new Set(LINES.map((l) => l.situation).filter((s) => s !== 'any')).size

const ARMOR_LABEL = { none: 'no armour', light: 'light armour', heavy: 'heavy armour', heaviest: 'the heaviest armour' } as const

const SOUNDS: { label: string; situation: Situation }[] = [
  { label: 'Game start', situation: 'game_start' },
  { label: 'Capture', situation: 'capture' },
  { label: 'Check', situation: 'check' },
  { label: 'Fork', situation: 'fork' },
  { label: 'Promotion', situation: 'promotion' },
  { label: 'Checkmate', situation: 'checkmate' },
  { label: 'Victory', situation: 'victory' },
  { label: 'Defeat', situation: 'defeat' },
]

const PIPELINE: [string, string][] = [
  ['Move', 'e.g. Nxc7+'],
  ['Situation', `check, fork, pin… ${SITUATIONS} kinds`],
  ['Speaker', 'the mover, or its victim'],
  ['Line', `${LINES.length} lines, picked by position`],
  ['Bubble + sound', 'no AI calls during replay'],
]

async function play(situation: Situation) {
  await unlockAudio()
  playSituation(situation)
}

export function Story({ onIntro }: { onIntro: () => void }) {
  return (
    <div className="story">
      <header className="px-panel story-hero">
        <div className="story-kanji">伊賀越え</div>
        <h1 className="story-title">The Night of Iga</h1>
        <p className="story-lead">
          June 1582. Oda Nobunaga has been betrayed and killed at Honnō-ji. Tokugawa Ieyasu is trapped far from home,
          hunted by Akechi Mitsuhide’s army. Legend says Hattori Hanzō, the “Demon Hanzō”, led him through the
          mountains of Iga to safety.
        </p>
        <p className="story-lead story-hook">Every game is that night, replayed.</p>
        <p className="story-sides">
          <span className="story-side side-tokugawa">
            <b>Tokugawa</b> our engine, Musashi
          </span>
          <span className="story-vs">vs</span>
          <span className="story-side side-akechi">
            <b>Akechi’s pursuers</b> Stockfish
          </span>
        </p>
        <div className="story-actions">
          <button className="px-btn px-btn-primary" onClick={onIntro}>
            ▶ Play the intro scroll
          </button>
          <a className="px-btn" href="#/">
            Watch a battle
          </a>
        </div>
      </header>

      <section className="story-section">
        <div className="px-panel story-section-head">
          <h2 className="panel-title story-h2">登場人物 The cast</h2>
          <p className="story-note">
            Every piece is a person. Each side has the same six roles; the clan colours follow whichever side the army
            plays. Hover a card to see its soldiers move.
          </p>
        </div>
        <div className="cast-grid">
          {CAST.map((c) => {
            const [ours, theirs] = c.lines.map((id) => byId.get(id))
            return (
              <article key={c.role} className="px-panel cast-card">
                <div className="cast-sprites">
                  <img className="cast-sprite" src={spriteUrl(c.piece, 'w')} alt={DISPLAY_NAME.tokugawa[c.role]} />
                  <img className="cast-sprite" src={spriteUrl(c.piece, 'b')} alt={DISPLAY_NAME.akechi[c.role]} />
                </div>
                <div className="cast-piece">
                  {c.chess} · {ARMOR_LABEL[ARMOR[c.role]]}
                </div>
                <h3 className="cast-names">
                  <span className="side-tokugawa">{DISPLAY_NAME.tokugawa[c.role]}</span>
                  <span className="cast-vs">vs</span>
                  <span className="side-akechi">{DISPLAY_NAME.akechi[c.role]}</span>
                </h3>
                <p className="cast-blurb">{c.blurb}</p>
                <p className="cast-moves">{c.moves}</p>
                <div className="cast-lines">
                  {ours && <q className="cast-line side-tokugawa">{ours.text}</q>}
                  {theirs && <q className="cast-line side-akechi">{theirs.text}</q>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="story-section px-panel">
        <h2 className="panel-title story-h2">話 How the pieces talk</h2>
        <div className="story-flow">
          {PIPELINE.map(([k, v], i) => (
            <div key={k} className="story-flow-step">
              <div className="story-box">
                <strong>{k}</strong>
                <span>{v}</span>
              </div>
              {i < PIPELINE.length - 1 && (
                <span className="story-arrow" aria-hidden="true">
                  ▶
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="story-note">
          After every move the replay works out what just happened: a check, a fork, a pin, a blunder, a quiet step.
          It picks who reacts, and chooses a fitting line in that character’s voice. The same position always shows
          the same line, and the pieces act it out: nodding, trembling, stamping, bowing.
        </p>
      </section>

      <section className="story-section px-panel">
        <h2 className="panel-title story-h2">音 Sound</h2>
        <p className="story-note">
          The music is synthesized in code (koto, taiko drums, a temple gong) and grows tense when a lord is in
          danger. Try the cues:
        </p>
        <div className="story-sounds">
          {SOUNDS.map((s) => (
            <button key={s.situation} className="px-chip" onClick={() => void play(s.situation)}>
              ♪ {s.label}
            </button>
          ))}
        </div>
      </section>

      <section className="story-section px-panel">
        <h2 className="panel-title story-h2">史 History vs legend</h2>
        <p className="story-note">{HISTORY_NOTE}</p>
      </section>
    </div>
  )
}
