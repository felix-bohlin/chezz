import { hermitNosebleedUrl, hermitUrl } from '../pixel/render'
import { KIND_LABEL, SENSEI_NAME, type SenseiSpeech } from '../story/sensei'

interface Props {
  /** What he says at the current ply; undefined = he dozes on his shell. */
  speech?: SenseiSpeech
}

function pawns(cp: number): string {
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
}

/** The hermit's perch beside the board: always there, speaks up on notable moves. */
export function Sensei({ speech }: Props) {
  const n = speech?.note
  const label = n ? KIND_LABEL[n.kind] : null
  const mood = n ? `sensei-${n.kind} sensei-by-${n.by}` : speech ? `sensei-${speech.occasion}` : 'sensei-idle'
  // An exceptional move is simply too much for the old man.
  const nosebleed = n?.kind === 'brilliant'
  return (
    <div className={`px-panel sensei-perch ${mood}`}>
      <div className="perch-scene" aria-hidden>
        <span className="perch-sun" />
        <span className="perch-sea" />
        <span className="perch-sand" />
        <span key={speech ? `${speech.ply}-${speech.lineId}` : 'idle'} className="perch-figure">
          <img className="perch-hermit" src={hermitUrl()} alt="" draggable={false} />
          {nosebleed && (
            <>
              <img className="perch-bleed" src={hermitNosebleedUrl()} alt="" draggable={false} />
              <span className="perch-drop d1" />
              <span className="perch-drop d2" />
              <span className="perch-drop d3" />
              <span className="perch-drop d4" />
            </>
          )}
        </span>
        {!speech && <span className="perch-zzz">z z Z</span>}
      </div>
      {speech ? (
        <div key={`${speech.ply}-${speech.lineId}`} className="perch-say" role="status">
          <span className="perch-head">
            <span className="perch-name">{SENSEI_NAME}</span>
            {label && (
              <span className="perch-kind">
                {label.kanji} {label.word} <b>{label.glyph}</b>
              </span>
            )}
          </span>
          <span className="perch-text">{speech.text}</span>
          {n && (
            <span className="perch-meta">
              {n.by === 'us' ? 'Musashi' : 'Stockfish'} {n.san}
              {label!.glyph}
              {(n.kind === 'blunder' || n.kind === 'mistake') && n.best !== '?' && <> · best {n.best}</>} · {pawns(n.before)} →{' '}
              {pawns(n.after)}
            </span>
          )}
        </div>
      ) : (
        <div className="perch-say perch-quiet">
          <span className="perch-head">
            <span className="perch-name">{SENSEI_NAME}</span>
          </span>
          <span className="perch-text">…dozing on his turtle shell. He wakes for blunders and fine blades.</span>
        </div>
      )}
    </div>
  )
}
