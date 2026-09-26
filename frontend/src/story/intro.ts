// Intro scroll script and end-screen titles. Spec: docs/story/01-intro-story.md.
// Master Roshi (story/sensei.ts) narrates: every line is spoken by him from a speech bubble.

export type PanelArt = 'sakai' | 'honnoji' | 'betrayal' | 'cornered' | 'oath' | 'board'

export interface IntroPanel {
  art: PanelArt
  caption: string
  narration: string
}

export const INTRO_PANELS: IntroPanel[] = [
  {
    art: 'sakai',
    caption: 'Sakai, dawn',
    narration: 'Hohoho! Sit down, sit down. Summer, 1582. Lord Tokugawa Ieyasu is a guest in Sakai, with only a handful of men.',
  },
  {
    art: 'honnoji',
    caption: 'Kyoto, night',
    narration: 'That same night, in Kyoto, the temple Honnō-ji burns. Oda Nobunaga, master of the realm, is dead.',
  },
  {
    art: 'betrayal',
    caption: 'The betrayal',
    narration: 'His own general, Akechi Mitsuhide, betrayed him. Now Akechi hunts every one of Nobunaga’s allies. Nasty business.',
  },
  {
    art: 'cornered',
    caption: 'Cornered',
    narration: 'Ieyasu is cut off from home. Between him and his castle lie the mountains of Iga: bandits, hunters, and Akechi’s scouts.',
  },
  {
    art: 'oath',
    caption: 'The oath',
    narration: 'Then one man steps forward. Hattori Hanzō, whom they call the Demon. “I know the Iga roads, my lord. I will bring you home.”',
  },
  {
    art: 'board',
    caption: 'The board',
    narration: 'Every game is that night, replayed. Now watch closely, and don’t blink.',
  },
]

export const HISTORY_NOTE =
  'In June 1582, after Nobunaga’s death at Honnō-ji, Tokugawa Ieyasu really did escape from the Sakai area through the Iga and Kōka mountains back to Mikawa — the Shinkun Iga-goe. Tokugawa-era accounts credit Hattori Hanzō Masanari with rallying Iga and Kōka men to guide and guard him; how much was Hanzō’s doing, and how “ninja” he was, is partly legend. Akechi Mitsuhide ruled for about two weeks before his defeat at Yamazaki, giving Japanese the phrase mikka tenka, “a three-day reign”. The pieces’ personalities are dramatized for the game.'

const SEEN_KEY = 'chezz.introSeen'

/** True until the viewer has finished or skipped the intro once (auto-play on first visit only). */
export function introUnseen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return false
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // non-essential
  }
}

export const ENDING_TITLE = {
  us: 'Ieyasu reaches home.',
  stockfish: 'The night was lost.',
  draw: 'The mountains keep their secret.',
} as const
