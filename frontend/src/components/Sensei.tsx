import { hermitUrl } from '../pixel/render'
import { KIND_LABEL, SENSEI_NAME, type SenseiComment } from '../story/sensei'

interface Props {
  comment: SenseiComment
  onDismiss: () => void
}

function pawns(cp: number): string {
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`
}

/** The hermit pops up from the corner of the board to judge the move just played. */
export function Sensei({ comment: c, onDismiss }: Props) {
  const label = KIND_LABEL[c.kind]
  const bad = c.kind === 'blunder' || c.kind === 'mistake'
  return (
    <button
      className={`sensei sensei-${c.kind} sensei-by-${c.by}`}
      onClick={onDismiss}
      aria-label={`${SENSEI_NAME}: ${c.text} (click to dismiss)`}
    >
      <img className="sensei-portrait" src={hermitUrl()} alt="" draggable={false} />
      <span className="sensei-box" role="status">
        <span className="sensei-head">
          <span className="sensei-name">{SENSEI_NAME}</span>
          <span className="sensei-kind">
            {label.kanji} {label.word} <b>{label.glyph}</b>
          </span>
        </span>
        <span className="sensei-text">{c.text}</span>
        <span className="sensei-meta">
          {c.by === 'us' ? 'Musashi' : 'Stockfish'} {c.san}
          {label.glyph}
          {bad && c.best !== '?' && <> · best was {c.best}</>} · {pawns(c.before)} → {pawns(c.after)}
        </span>
      </span>
    </button>
  )
}
