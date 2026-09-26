// The old turtle hermit who judges the replay (story/sensei.ts, components/Sensei.tsx): bald dome,
// bushy brows, red-framed shades, a beard to his belly, Hawaiian shirt, orb pendant, turtle shell and a
// wooden staff. Full body, 30x46; drawn from the user's reference sketch. HERMIT is the standing pose;
// the walk, startled and nap frames below share its size and bottom line (HERMIT_FRAMES).

export const HERMIT_PALETTE: Record<string, string> = {
  o: '#1a1220', // outline
  s: '#f2c9a0', // skin
  t: '#d49a72', // skin shade
  e: '#fff4e0', // shine on the dome
  W: '#f6f2e8', // brows and beard
  G: '#c9c1b0', // beard strands
  r: '#d23c2a', // glasses frame
  g: '#3fae5a', // green lenses
  l: '#b8f0b0', // lens glint
  O: '#f0a030', // Hawaiian shirt
  P: '#c67a1c', // shirt shade
  V: '#7a4ea3', // shirt triangles
  k: '#2a2233', // shirt print / sandals
  H: '#f4f1ea', // shorts
  h: '#c9c1b0', // shorts shade
  U: '#8a68b8', // turtle shell
  u: '#5a4088', // shell plates
  w: '#a8703c', // staff
  x: '#6a3f1c', // staff shade
  Y: '#f7b52c', // orb pendant
  R: '#d23c2a', // orb star
}

export const HERMIT: string[] = [
  '..............................',
  '..............................',
  '.....ooo......ooooo...........',
  '....owwwo...oosssssoo.........',
  '....owwwo..oseesssssso........',
  '...owwwxwo.osessssssso........',
  '...owwwwwoossssssssssso.......',
  '...owwwwwoossssssssssso.oW....',
  '...owwwxwoWWWWWWssWWWWWWW.....',
  '...owwwwworrrrrrrrrrrrrro.....',
  '...owwwwworlggggrrlggggrso....',
  '....owwxosrrrrrrssrrrrrrso....',
  '....owxwooooooooooooooooo.....',
  '.....owxooWWWWWWWWWWWWWWo.....',
  '.....owxoWWWWWWWWWWWWWWWWo....',
  '.....owxoWWGWWGWWGWWGWWGWoo...',
  '.....owxooWGWWGWWGWWGWWWoUUo..',
  '.....owxoooGWWGWWGWWGWWooooUo.',
  '.....owxOOoWWWGWWGWWGWWoOOOoo.',
  '.....owxVVPoWWGWWGWWGWoPOVVoo.',
  '....oowxVOPOoWGWWGWWWoOPOVOoUo',
  '....oowxOOPOOoWWWGWWoOOPOOoUUo',
  '....oowxoOPOOOoWWWWoOOOPoooUUo',
  '....oosssoPVVOOooooOOOVossoUUo',
  '....ootssoPVOOOoRYoOOOVossouUo',
  '....oowxooPkOOOoYYoOOOOossouUo',
  '....oowxooPOOVVOooOkOOOossoUUo',
  '....oowxooPOOVOOPOOOVVOossoUUo',
  '....oowxooPOOOOOPOOOVOOossoUUo',
  '....oowxooPOOOkOPOOOOOOossouUo',
  '.....owxooPOOOOOPOVVOOkostouo.',
  '.....owxooPOOOOOPOVOOOOossoUo.',
  '.....owxoUooooooooooooooooUUo.',
  '.....owxooHHHHHHhhHHHHHHoUUo..',
  '.....owxooHHHHHHhhHHHHHHouo...',
  '.....owxooHHHHHHooHHHHHHoo....',
  '.....owxooooooooUUooooooo.....',
  '.....owxo.ostoUUUUUostoo......',
  '.....owxo.ostoUUUUUosto.......',
  '.....owxo.ostooooooosto.......',
  '.....owxo.osto.....osto.......',
  '.....owxo..osto...osto........',
  '.....owxooooooo...ooooooo.....',
  '.....owxokkkkkko..okkkkkko....',
  '......oo.oooooo....oooooo.....',
  '..............................',
]

/** Nosebleed overlay for exceptional moves: [x, y, light?] pixels running from the nose over the mustache. */
export const HERMIT_NOSEBLEED: [number, number, boolean][] = [
  [16, 12, true], [17, 12, true],
  [15, 13, true], [16, 13, false], [17, 13, true], [18, 13, false],
  [15, 14, true], [16, 14, false], [18, 14, true], [19, 14, false],
  [14, 15, true], [15, 15, false], [19, 15, true],
  [14, 16, true], [15, 16, false], [19, 16, true], [20, 16, false],
  [14, 17, false], [20, 17, true],
  [13, 18, true], [20, 18, false],
  [13, 19, false],
]

/** Copy of `base` with the given rows replaced (row index → 30-char row). */
function patched(base: string[], rows: Record<number, string>): string[] {
  const out = [...base]
  for (const [k, v] of Object.entries(rows)) out[Number(k)] = v
  return out
}

// Walk cycle: one foot lifted a row at a time (rows 41-44 are the legs' ends and the sandals).
export const HERMIT_WALK_A = patched(HERMIT, {
  41: '.....owxooooooo...osto........',
  42: '.....owxokkkkkko..ooooooo.....',
  43: '.....owxooooooo...okkkkkko....',
  44: '......oo...........oooooo.....',
})
export const HERMIT_WALK_B = patched(HERMIT, {
  41: '.....owxo..osto...ooooooo.....',
  42: '.....owxooooooo...okkkkkko....',
  43: '.....owxokkkkkko..oooooo......',
  44: '......oo.oooooo...............',
})

// Startled: brows shoot up a row, both feet tuck two rows off the ground. The nose stays put, so
// HERMIT_NOSEBLEED still lines up while he is speaking.
export const HERMIT_STARTLED = patched(HERMIT, {
  7: '...owwwwwoWWWWWWssWWWWWWW.....',
  8: '...owwwxwoossssssssssssso.....',
  40: '.....owxooooooo...ooooooo.....',
  41: '.....owxokkkkkko..okkkkkko....',
  42: '.....owxooooooo....oooooo.....',
  43: '......oo......................',
  44: '..............................',
})

// Nap: seated cross-legged, back against the shell, head slumped into the beard, staff planted beside him.
export const HERMIT_NAP: string[] = [
  '..............................',
  '..............................',
  '.....ooo......................',
  '....owwwo.....................',
  '....owwwo.....................',
  '...owwwxwo....................',
  '...owwwwwo....................',
  '...owwwwwo....................',
  '...owwwxwo....................',
  '...owwwwwo....................',
  '...owwwwwo....................',
  '....owwxo.....................',
  '.....owxo.....ooooo...........',
  '.....owxo...oosssssoo.........',
  '.....owxo..oseesssssso........',
  '.....owxo..osessssssso........',
  '.....owxo.ossssssssssso.......',
  '.....owxo.ossssssssssso.oW....',
  '.....owxo.WWWWWWssWWWWWWW.....',
  '.....owxoorrrrrrrrrrrrrro.....',
  '.....owxoorlggggrrlggggrso....',
  '.....owxosrrrrrrssrrrrrrso....',
  '.....owxooooooooooooooooo.....',
  '.....owxoWWWWWWWWWWWWWWWWo....',
  '.....owxoWWGWWGWWGWWGWWGWoo...',
  '.....owxooWGWWGWWGWWGWWWoUUo..',
  '.....owxoooGWWGWWGWWGWWooooUo.',
  '.....owxOOoWWWGWWGWWGWWoOOOoo.',
  '.....owxVVPoWWGWWGWWGWoPOVVoo.',
  '.....owxVOPOoWGWWGWWWoOPOVOoUo',
  '.....owxOOPOOoWWWGWWoOOPOOoUUo',
  '.....owxoOPOOOoWWWWoOOOPoooUUo',
  '.....owxooPVVOOooooOOOVossoUUo',
  '.....owxooPVOOOoRYoOOOVossouUo',
  '.....owxooPkOOOoYYoOOOOossouUo',
  '.....owxooPOOVVOooOkOOOossoUUo',
  '.....owxooPOOVOOPOOOVVOossoUUo',
  '.....owxooPOOOOOPOOOVOOossoUUo',
  '.....owxooPOOOkOPOOOOOOossouUo',
  '.....owxooPOOOOOPOVVOOkostouo.',
  '.....owxooPOOOOOPOVOOOOossoUo.',
  '.....owxoUooooooooooooooooUUo.',
  '.....owxooHHHHHHhhHHHHHHoUUo..',
  '.....owxookkkttssssssttkkkoo..',
  '......oo.oooooooooooooooooo...',
  '..............................',
]

export const HERMIT_FRAMES = {
  stand: HERMIT,
  walkA: HERMIT_WALK_A,
  walkB: HERMIT_WALK_B,
  startled: HERMIT_STARTLED,
  nap: HERMIT_NAP,
} as const
export type HermitFrame = keyof typeof HERMIT_FRAMES

/** Grid sanity check for the preview script: every frame 46 rows of 30 known keys. */
export function hermitProblems(): string[] {
  const out: string[] = []
  for (const [name, grid] of Object.entries(HERMIT_FRAMES)) {
    if (grid.length !== HERMIT.length) out.push(`${name}: ${grid.length} rows, expected ${HERMIT.length}`)
    grid.forEach((row, y) => {
      if (row.length !== HERMIT[0].length) out.push(`${name} row ${y}: ${row.length} chars`)
      for (const ch of row) if (ch !== '.' && !(ch in HERMIT_PALETTE)) out.push(`${name} row ${y}: unknown key '${ch}'`)
    })
  }
  return out
}
