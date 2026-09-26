// The old turtle hermit who judges the replay (story/sensei.ts, components/Sensei.tsx): bald dome,
// bushy brows, red-framed shades, a beard to his belly, Hawaiian shirt, orb pendant, turtle shell and a
// wooden staff. Full body, 30x46; drawn from the user's reference sketch.

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
