// Pixel-art army. Each sprite is a 20x20 grid of palette keys; '.' is transparent.
// Team-colored keys (a b c d f g) come from the clan palette, the rest are shared.

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Army = 'w' | 'b'

export const SPRITE_SIZE = 20

export const SHARED: Record<string, string> = {
  o: '#1a1220', // outline
  r: '#e0b13c', // gold trim
  s: '#f2c9a0', // skin
  t: '#c98f6b', // skin shade
  h: '#231c2b', // black lacquer / hair
  k: '#3d3449', // dark cloth
  m: '#eef3f8', // steel
  n: '#98a6b9', // steel shade
  w: '#7c4a27', // wood
  x: '#4a2c17', // dark wood
  e: '#ffffff',
}

export const CLANS: Record<Army, Record<string, string>> = {
  // White clan: ivory lacquer with indigo roofs and mon
  w: { a: '#ece3cc', b: '#bfb194', c: '#fffaf0', d: '#2f3f73', f: '#f6f1e6', g: '#2f3f73' },
  // Red clan: crimson lacquer with charcoal roofs and gold mon
  b: { a: '#c0262f', b: '#7a1219', c: '#e9545a', d: '#2a2233', f: '#c0262f', g: '#f2cf5b' },
}

export const SPRITES: Record<PieceType, string[]> = {
  // Ashigaru spearman with sashimono banner
  p: [
    '...ooooo........o...',
    '...offfo.......omo..',
    '...ofgfo.......omo..',
    '...ofgfo.......omo..',
    '...offfo.......ono..',
    '...ooooo........w...',
    '...o...oooo.....w...',
    '...o.oaacaaao...w...',
    '...ooaaaaaaaao..w...',
    '...o..ohhhho....w...',
    '...o..osssso....w...',
    '...o..ohssho....w...',
    '...o...otto.....w...',
    '...oobbaaaabbo..w...',
    '...oobaaccaaabbbso..',
    '...oobaaccaaboow....',
    '...oorrrrrrrro..w...',
    '....obaobaobao..w...',
    '.....okko.okko..w...',
    '.....oooo.oooo..o...',
  ],
  // Iga ninja on horseback: raised katana, flying headband, clan saddle cloth
  n: [
    '................mn..',
    '.......oooo....mn...',
    '..rrrrorrrro..mn....',
    '.rr...okekeo.mn.....',
    '......oaaaaomn..oo..',
    '.....oobbbborroowwo.',
    '....obaaaaassohwwwwo',
    '....obaacaabohwwwkwo',
    '....okkkkkkkhwwwwwwo',
    '..ooooaakaaohwwwwxxo',
    '.ohwwwaakaawwwwwooo.',
    'ohhwwwaakaawwwwwo...',
    'ohowwwbbhbbwwwwwo...',
    'ohowwwwwwwwwwwwwo...',
    'hoowxxxxxxxxxxxwo...',
    'o..oxowoooooowowwo..',
    '...oxowo....owooowo.',
    '...oxowo....owo.oho.',
    '...ohoho....oho..o..',
    '....o.o......o......',
  ],
  // Warrior monk (sohei) with naginata
  b: [
    '...o................',
    '..omo...............',
    '..omo...............',
    '..omo....oooo.......',
    '..ono..oaaaaaao.....',
    '...w..oaaaaaaaao....',
    '...w..oaassssaao....',
    '...w..oaahsshaao....',
    '...w..oaasttsaao....',
    '...w..oaaaaaaaao....',
    '...w.obbaaaaaabbo...',
    '..osbbbaaaaaaaabo...',
    '...w.obaarrrraabo...',
    '...w.obaaaaraaabo...',
    '...wobaaaaaaaaaabo..',
    '...wobaaacaaaaaabo..',
    '...wobaaacaaaaaabo..',
    '...wobbaaaaaaaabbo..',
    '...worrrrrrrrrrrro..',
    '...o....oo..oo......',
  ],
  // Tenshu castle keep
  r: [
    '........r..r........',
    '.......oddddo.......',
    '......oddddddo......',
    '....ooddddddddoo....',
    '......oahaahao......',
    '....oddddddddddo....',
    '..oodddddddddddddoo.',
    '....orrrrrrrrrro....',
    '....oaaaaaaaaaao....',
    '....oahhaaaahhao....',
    '....oahhaaaahhao....',
    '....obaaaaaaaabo....',
    '...oddddddddddddo...',
    '.oodddddddddddddddoo',
    '...orrrrrrrrrrrro...',
    '...oaaaaohhoaaaao...',
    '...oaaaaohhoaaaao...',
    '..onmnmnohhonmnmno..',
    '.onmnmnmnmnmnmnmnmo.',
    '.oooooooooooooooooo.',
  ],
  // Hanzō the Demon: horned oni helmet, gold eyes and fangs, twin katanas crossed on the back
  q: [
    '....m.......m.......',
    '....mo.....om.......',
    '.....mo...om........',
    '....oohhhhhhoo......',
    '...ohhhhhhhhhho.....',
    '...ohddddddddho.....',
    '...ohhhhhhhhhho.....',
    'o...ohrrhhrrho.....o',
    'ho..ohhhhhhhho....oh',
    'oho.ohehhhheho...oho',
    '.oro.ohhhhhho...oro.',
    '..ooaabaaaaaabaaoo..',
    '..oobbaaaaaaaabboo..',
    '.omoobbbbbbbbbboomo.',
    'omo.oaaaarraaaao.omo',
    'no..obbbbbbbbbbo..on',
    'o...orrrrrrrrrro...o',
    '...oabaabaabaabao...',
    '....okko....okko....',
    '....oooo....oooo....',
  ],
  // Shogun with golden kuwagata crest and twin clan banners
  k: [
    '.ooo..r......r..ooo.',
    '.ofo..r......r..ofo.',
    '.ogo...r....r...ogo.',
    '.ofo...r....r...ofo.',
    '.ofo....rrrr....ofo.',
    '.ooo...oooooo...ooo.',
    '..o...oddrrddo...o..',
    '..o.ooddddddddoo.o..',
    '..ooaaaaaaaaaaaaoo..',
    '..o.oaaossssoaao.o..',
    '..o.oaaohsshoaao.o..',
    '..o.oaaoshhsoaao.o..',
    '..o....osttso....o..',
    '.oaabaaaaaaaaaabaao.',
    '.obbaaaaaggaaaaabbo.',
    '..oaaaaaaggaaaaaao..',
    '...orrrrrrrrrrrro...',
    '...oabaabaabaabao...',
    '....okkko..okkko....',
    '....ooooo..ooooo....',
  ],
}

export function colorFor(key: string, army: Army): string | null {
  if (key === '.' || key === ' ') return null
  return CLANS[army][key] ?? SHARED[key] ?? null
}

/** Rows that aren't exactly SPRITE_SIZE wide — used by the preview script to catch typos. */
export function spriteProblems(): string[] {
  const out: string[] = []
  for (const [name, rows] of Object.entries(SPRITES)) {
    if (rows.length !== SPRITE_SIZE) out.push(`${name}: ${rows.length} rows`)
    rows.forEach((row, i) => {
      if (row.length !== SPRITE_SIZE) out.push(`${name} row ${i}: ${row.length} cols "${row}"`)
    })
  }
  return out
}
