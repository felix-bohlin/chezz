// The port town of Kumoi, Ise Province — the town plan. Coordinates are tiles (16 px).
//
//   y   2–20  Kōun-ji temple on the hill: sanmon gate, main hall, five-storey pagoda, bell tower,
//             graveyard, koi pond. A cliff (y 21–25) with the grand staircase down the middle.
//   y 26–31   temple approach: incense shop, dango stand, the road down to the north gate.
//   y 32–84   the walled city inside its moat. Gates N/S/W/E with bridges, corner towers.
//             NW samurai quarter · NE castle · centre town square · S craftsmen, inn, brewery.
//   y 85–97   the harbour: warehouses, shipwright, fish market, tavern, harbour office, quay.
//   y 98+     the sea: piers, a merchant ship, the breakwater lighthouse, and Roshi's island.
//   west      rice paddies and farms; west beach.     east  woods, river, the old shrine; east beach.

import { rng } from '../engine/rng'
import { Builder, CROP, idx, T, type TreeKind, type World } from './layout'

// City walls (inclusive tile lines) and moat ring.
const WX0 = 32
const WX1 = 111
const WY0 = 36
const WY1 = 80

export function buildWorld(): World {
  const B = new Builder()
  terrain(B)
  city(B)
  temple(B)
  harbour(B)
  farms(B)
  east(B)
  island(B)
  districts(B)
  nature(B)
  return {
    w: B.w,
    h: B.h,
    tiles: B.tiles,
    crops: B.crops,
    planted: B.planted,
    buildings: B.buildings,
    props: B.props,
    places: B.places,
    areas: B.areas,
    districts: B.districts,
    start: { x: 130, y: 108 },
  }
}

/** Coastline: first sea row per column. */
export function coastY(x: number): number {
  if (x >= 18 && x <= 111) return 98
  return 97 + Math.round(1.3 * Math.sin(x / 6.5) + 0.8 * Math.sin(x / 2.7 + 1))
}

export function riverX(y: number): number {
  return 127 + Math.round(2 * Math.sin(y / 9) + Math.sin(y / 4 + 2))
}

function terrain(B: Builder): void {
  // Forest band on the north, west and east edges.
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) if (y <= 1 || x <= 1 || x >= B.w - 2) B.set(x, y, T.Forest)
  // Sea and beaches.
  for (let x = 0; x < B.w; x++) {
    const c = coastY(x)
    for (let y = c; y < B.h; y++) B.set(x, y, T.Sea)
    if (x < 18 || x > 115) for (let y = c - 8 + Math.round(Math.sin(x / 3) * 1.5); y < c; y++) B.set(x, y, T.Sand)
  }
  // River down the east side into the sea.
  for (let y = 0; y < B.h; y++) {
    const c = riverX(y)
    for (let dx = -1; dx <= 1; dx++) if (B.get(c + dx, y) !== T.Sea) B.set(c + dx, y, T.Water)
  }
  // Moat ring with the city (and its grass berm) inside.
  B.fill(28, 32, 88, 53, T.Moat)
  B.fill(31, 35, 82, 47, T.Grass)
  // East channel from the moat down to the sea.
  B.fill(112, 85, 4, 13, T.Moat)
  // Roads in and out: west to Sakai, east to Okazaki, north to the temple.
  B.fill(0, 56, 28, 2, T.Road)
  B.fill(116, 56, 28, 2, T.Road)
  B.fill(70, 26, 4, 6, T.Road)
  // Bridges over the moat (and the east road over the river).
  B.fill(70, 32, 4, 3, T.Bridge)
  B.fill(70, 82, 4, 3, T.Bridge)
  B.fill(28, 56, 3, 2, T.Bridge)
  B.fill(113, 56, 3, 2, T.Bridge)
  for (let x = riverX(56) - 2; x <= riverX(57) + 2; x++) for (const y of [56, 57]) if (B.get(x, y) === T.Water) B.set(x, y, T.Bridge)
}

// ---------------------------------------------------------------------------------------------
// The city inside the walls
// ---------------------------------------------------------------------------------------------

function city(B: Builder): void {
  // Streets.
  B.fill(70, 35, 4, 47, T.Road) // the avenue, gate to gate
  B.fill(31, 56, 82, 2, T.Road) // main street, gate to gate
  B.fill(33, 46, 37, 2, T.Road) // samurai lane
  B.fill(33, 70, 78, 2, T.Road) // south street
  B.fill(36, 78, 72, 2, T.Road) // lane inside the south wall
  B.fill(33, 40, 1, 37, T.Road) // path inside the west wall
  B.fill(110, 58, 1, 19, T.Road) // path inside the east wall
  B.fill(58, 48, 28, 16, T.Stone) // the town square
  B.fill(87, 37, 24, 16, T.Gravel) // castle yard
  B.fill(97, 54, 2, 2, T.Road)

  // Walls with corner towers and four gates.
  const towers = [
    { id: 'towerNW', x: WX0, y: WY0 },
    { id: 'towerNE', x: WX1 - 3, y: WY0 },
    { id: 'towerSW', x: WX0, y: WY1 - 3 },
    { id: 'towerSE', x: WX1 - 3, y: WY1 - 3 },
  ]
  for (const t of towers)
    B.building({
      id: t.id,
      kind: 'tower',
      name: 'Corner tower',
      x: t.x,
      y: t.y,
      w: 4,
      h: 4,
      door: { x: t.x + (t.x === WX0 ? 4 : -1), y: t.y + (t.y === WY0 ? 4 : 1) },
      text: 'A corner tower. Archers watch the sea from up there. Mostly they watch the fish market.',
      litHours: [[1110, 1350]],
    })
  const gateText = (where: string) => [`The ${where}. Iron-studded doors, open from dawn till late.`, 'The guards say it closes at night. The guards are asleep at night.']
  B.building({ id: 'gateN', kind: 'gate', name: 'North Gate', x: 68, y: WY0 - 1, w: 8, h: 3, door: { x: 71, y: WY0 + 2 }, open: rect(70, WY0 - 1, 4, 3), text: gateText('North Gate') })
  B.building({ id: 'gateS', kind: 'gate', variant: 'sea', name: 'Sea Gate', x: 68, y: WY1 - 1, w: 8, h: 3, door: { x: 71, y: WY1 + 2 }, open: rect(70, WY1 - 1, 4, 3), text: gateText('Sea Gate') })
  B.building({ id: 'gateW', kind: 'gateSide', name: 'West Gate', x: WX0 - 1, y: 53, w: 3, h: 6, door: { x: WX0 + 2, y: 55 }, open: rect(WX0 - 1, 56, 3, 2), text: gateText('West Gate') })
  B.building({ id: 'gateE', kind: 'gateSide', name: 'East Gate', x: WX1 - 1, y: 53, w: 3, h: 6, door: { x: WX1 - 2, y: 55 }, open: rect(WX1 - 1, 56, 3, 2), text: gateText('East Gate') })

  const wallText = 'The town wall: river stones below, white plaster above, clay tiles on top. Turtles: not allowed over.'
  const wall = (x: number, y: number) => {
    if (B.isTaken(x, y)) return
    B.prop({ kind: 'wall', x, y, solid: true, name: 'Town wall', text: wallText })
  }
  for (let x = WX0; x <= WX1; x++) {
    wall(x, WY0)
    wall(x, WY1)
  }
  for (let y = WY0; y <= WY1; y++) {
    wall(WX0, y)
    wall(WX1, y)
  }

  // --- NW: samurai quarter ---
  const samurai = [
    { id: 'samuraiSakuma', name: 'Sakuma residence', x: 36 },
    { id: 'samuraiIori', name: 'Iori residence', x: 47 },
  ]
  for (const s of samurai)
    B.building({
      id: s.id,
      kind: 'samurai',
      name: s.name,
      x: s.x,
      y: 40,
      w: 9,
      h: 6,
      doorX: s.x + 4,
      text: ['A samurai house: plaster walls, a pine pruned within an inch of its life.', 'A servant peers out, sees a turtle, and decides it is not their problem.'],
    })
  B.building({ id: 'riceShop', kind: 'shop', variant: 'rice', name: 'Rihei Rice Merchant', x: 58, y: 41, w: 6, h: 5, doorX: 60, text: 'Rice bales stacked to the rafters. A sign: "Rice for samurai stipends. And everyone else, at a markup."' })
  B.building({ id: 'sweetShop', kind: 'shop', variant: 'sweets', name: 'Yohei Sweets', x: 64, y: 41, w: 6, h: 5, doorX: 66, text: 'Sweet bean cakes in the window. The window has nose prints. Children’s. Probably.' })

  // Merchant street west of the square.
  B.building({ id: 'bathhouse', kind: 'bathhouse', name: 'Bathhouse', x: 36, y: 50, w: 8, h: 6, doorX: 39, text: ['The bathhouse. Blue curtain for men, red for women.', 'No sign about turtles. You note that for later.'] })
  B.building({ id: 'clothShop', kind: 'shop', variant: 'cloth', name: 'Osen Cloth', x: 45, y: 51, w: 6, h: 5, doorX: 47, text: 'Bolts of indigo and persimmon cloth. One very loud bolt of pink. Osen calls it "bold".' })
  B.building({ id: 'medicine', kind: 'shop', variant: 'medicine', name: 'Sōan Medicines', x: 52, y: 51, w: 6, h: 5, doorX: 54, text: 'Dried roots, powdered horn, and a jar labelled "do not". Everyone respects the jar.' })

  // --- NE: Inari shrine, teahouse, castle ---
  B.building({ id: 'inari', kind: 'shrine', variant: 'small', name: 'Inari shrine', x: 80, y: 37, w: 4, h: 3, doorX: 81, text: ['A tiny Inari shrine. Two stone foxes guard it.', 'Someone left fried tofu. The foxes did not eat it. Suspicious foxes.'] })
  B.prop({ kind: 'komainu', x: 79, y: 40, solid: true, variant: 'fox', name: 'Stone fox', text: 'A stone fox with a red bib. It has seen things.' })
  B.prop({ kind: 'komainu', x: 84, y: 40, solid: true, variant: 'fox', name: 'Stone fox', text: 'The other stone fox. It has seen the same things, from the other side.' })
  B.building({ id: 'teahouse', kind: 'teahouse', name: "Oume's Teahouse", x: 75, y: 42, w: 7, h: 6, doorX: 78, text: ['The curtain reads: TEA · DANGO · GOSSIP.', 'The gossip is free. The dango is not.'] })

  // Castle: inner walls, inner gate, the keep.
  for (let y = 37; y <= 53; y++) if (!B.isTaken(86, y)) B.prop({ kind: 'wall', x: 86, y, solid: true, name: 'Castle wall', text: 'The castle’s inner wall. Higher and whiter than the town’s. Lords like white.' })
  B.building({ id: 'gateCastle', kind: 'gate', variant: 'inner', name: 'Castle Gate', x: 94, y: 52, w: 8, h: 3, door: { x: 97, y: 55 }, open: rect(97, 52, 2, 3), text: ['The castle gate. Two very straight guards could stand here.', 'Today there is one slightly bent guard and a cat.'] })
  for (let x = 87; x <= WX1 - 1; x++) if (!B.isTaken(x, 53)) B.prop({ kind: 'wall', x, y: 53, solid: true, name: 'Castle wall', text: 'The castle’s inner wall.' })
  B.building({ id: 'castle', kind: 'castle', name: 'Kumoi Castle', x: 93, y: 39, w: 9, h: 7, doorX: 97, litHours: [[1080, 1380]], text: ['Kumoi Castle. Five roofs, two golden fish on top, one lord who is never home.', 'The steward says the lord is "in Kyoto, with Lord Nobunaga". Must be nice.'] })
  B.building({ id: 'stable', kind: 'workshop', variant: 'stable', name: 'Castle stable', x: 103, y: 46, w: 6, h: 4, doorX: 105, text: 'The castle stable. One horse. It looks at you as if you are the slowest thing it has ever seen. It is right.' })

  // --- the square ---
  B.building({ id: 'watchtower', kind: 'watchtower', name: 'Fire watchtower', x: 59, y: 48, w: 3, h: 3, doorX: 60, text: ['The fire watchtower. A bell at the top for fires, earthquakes and, once, a very large carp.', 'Climbing is forbidden. Also impossible, for you.'] })
  B.prop({ kind: 'tree', x: 84, y: 50, variant: 'sacred', solid: true, name: 'Old camphor', text: 'The square’s old camphor tree. Everyone meets "under the camphor". Everyone is late.' })
  B.prop({
    kind: 'board',
    variant: 'contracts',
    x: 83,
    y: 58,
    w: 2,
    solid: true,
    name: 'Contracts',
    text: [
      'CONTRACT: A kappa in the castle moat drowns ducks and steals cucumbers. Bring proof (the plate off its head). Reward: three mon and a cucumber. — The Steward',
      'CONTRACT: On the temple hill at night, something screams like a monkey. Tiger’s legs, snake for a tail. A nue. Reward: prayers. — Kōun-ji',
      'WANTED: Agents of Lord Akechi Mitsuhide, travelling as pilgrims. Recognise them by the bellflower crest, which they will surely be wearing.',
      'CONTRACT: Rats in the fish market. One took a whole bonito and looked Oshio in the eye. Reward: all the fish you can carry. (None.)',
      'CONTRACT: Our ox will not stop staring at the moon. Exorcist wanted. Cheap. — Yasaku',
      'Someone has added, in a child’s hand: "IGA PEOPLE ARE NOT NINJA. — a ninja".',
      'You are a turtle. You decline every contract. You read them all again anyway.',
    ],
  })
  B.place('beggarSpot', 71, 63, 'down')
  B.prop({ kind: 'well', x: 78, y: 60, solid: true, name: 'Well', text: 'You look down the well. A turtle looks back up. Handsome fellow.' })
  B.prop({
    kind: 'board',
    x: 59,
    y: 61,
    w: 2,
    solid: true,
    name: 'Notice board',
    text: [
      'NOTICE: Lord Oda Nobunaga honours Kyoto with a visit. He stays at Honnō-ji temple with a modest escort.',
      'All is calm in the realm. Nothing could possibly go wrong.',
      'HARBOUR: the master asks that a fast boat be kept ready "for an important guest". He will not say who.',
      'LOST: one sandal, left foot. Answers to "Sanpei’s sandal". Reward: a fish (small).',
      'Market day every third day. Jinbei the peddler brings combs, fans and rumours.',
    ],
  })
  B.prop({ kind: 'table', x: 63, y: 55, solid: true, name: 'Fortune table', text: 'A fortune teller’s table: bamboo sticks, a cracked bowl, and a sign: "THE FUTURE. Cheap."' })
  for (const [x, y, v] of [
    [63, 51, 'fish'],
    [66, 51, 'veg'],
    [75, 59, 'fans'],
    [81, 59, 'pots'],
    [62, 59, 'veg'],
  ] as const)
    B.prop({ kind: 'stall', x, y, w: 2, variant: v, solid: true, name: 'Market stall', text: stallText(v) })
  B.prop({ kind: 'bench', x: 74, y: 50, w: 2, variant: 'parasol', solid: true, npcSolid: false, name: 'Bench', text: 'A teahouse bench under a red parasol. The red felt is warm from the sun.' })
  B.prop({ kind: 'bench', x: 80, y: 50, w: 2, solid: true, npcSolid: false, name: 'Bench', text: 'A teahouse bench. Someone left a dango skewer. Heisuke, probably.' })
  B.prop({ kind: 'bench', x: 66, y: 62, w: 2, solid: true, npcSolid: false, name: 'Bench', text: 'A stone bench, worn smooth by a hundred years of gossip.' })
  for (const [x, y] of [
    [68, 53],
    [77, 53],
    [64, 61],
  ])
    B.prop({ kind: 'tree', x, y, variant: 'pine', solid: true, name: 'Pine', text: 'A pine pruned into clouds. The gardener visits weekly and argues with it.' })
  B.prop({ kind: 'cart', x: 59, y: 54, w: 2, solid: true, name: 'Handcart', text: 'A handcart loaded with radishes. One wheel is slightly smaller. It’s Yasaku’s.' })
  B.prop({ kind: 'kago', x: 82, y: 54, w: 2, solid: true, name: 'Palanquin', text: ['A palanquin, waiting for someone important.', 'The bearers are at the teahouse. The important person is also at the teahouse.'] })
  B.prop({ kind: 'cart', x: 83, y: 61, w: 2, variant: 'barrels', solid: true, name: 'Handcart', text: 'A cart of sake barrels. Kurozaemon has counted them. Twice. He’s watching you.' })
  B.prop({ kind: 'nobori', x: 82, y: 48, solid: true, name: 'Banner', text: 'A banner: 茶 (tea). Flapping like it’s proud of it.' })
  for (const [x, y] of [
    [58, 63],
    [85, 63],
    [69, 48],
    [74, 48],
    [69, 63],
    [74, 63],
  ])
    lantern(B, x, y)

  // --- south: craftsmen, inn, brewery ---
  B.building({ id: 'smithy', kind: 'smithy', name: 'Tetsuzō Forge', x: 36, y: 65, w: 6, h: 5, doorX: 38, text: ['The forge. It’s hot enough to boil a turtle. Do not lean in.', 'Hammers, tongs, and a half-finished kitchen knife "for a samurai’s wife".'] })
  B.building({ id: 'carpenter', kind: 'workshop', variant: 'carpenter', name: 'Gorō Carpentry', x: 43, y: 65, w: 6, h: 5, doorX: 45, text: 'Sawdust, planks, and a half-built shrine for somebody’s grandmother.' })
  B.building({ id: 'umbrella', kind: 'workshop', variant: 'umbrella', name: 'Okane Umbrellas', x: 50, y: 65, w: 6, h: 5, doorX: 52, text: 'Oiled-paper umbrellas drying open like flowers. The rainy season is good business.' })
  B.building({ id: 'nagayaA', kind: 'nagaya', name: 'Row houses', x: 57, y: 66, w: 12, h: 4, doorX: 62, text: 'Row houses: thin walls, loud neighbours, and somebody frying fish right now.' })
  B.building({ id: 'inn', kind: 'inn', name: 'Shiokaze Inn', x: 75, y: 64, w: 9, h: 6, doorX: 79, text: ['The Shiokaze Inn. "Travellers, merchants, pilgrims. Turtles by arrangement."', 'Arrangement not available.'] })
  B.building({ id: 'tofu', kind: 'shop', variant: 'tofu', name: 'Heikichi Tofu', x: 85, y: 65, w: 6, h: 5, doorX: 87, text: 'Tubs of tofu in cold water. The tofu maker has been awake since three. It shows.' })
  B.building({ id: 'brewery', kind: 'brewery', name: 'Kurozaemon Brewery', x: 92, y: 63, w: 9, h: 7, doorX: 96, text: ['A sign on the door: NO TURTLES.', 'It has a little drawing of a turtle with a line through it. Very specific.'] })
  B.prop({ kind: 'casks', x: 102, y: 69, w: 2, solid: true, name: 'Sake casks', text: ['Straw-wrapped sake casks, stacked high.', 'You knock on one. It sloshes. Your errand sloshes.'] })
  B.building({ id: 'kuraBrew', kind: 'kura', name: 'Brewery storehouse', x: 104, y: 64, w: 4, h: 5, doorX: 105, text: 'Locked. It smells of sake. Your errand is in there. So close.' })
  B.building({ id: 'nagayaB', kind: 'nagaya', name: 'Row houses', x: 37, y: 74, w: 12, h: 4, doorX: 42, text: 'Row houses. A baby crying, a cat answering.' })
  B.building({ id: 'nagayaC', kind: 'nagaya', name: 'Row houses', x: 51, y: 74, w: 12, h: 4, doorX: 56, text: 'Row houses. Someone inside is practising the shakuhachi. Badly.', litHours: [[1080, 1320]] })
  B.building({ id: 'houseHachi', kind: 'machiya', name: 'Townhouse', x: 63, y: 73, w: 6, h: 5, doorX: 65, text: 'A townhouse. Muddy little footprints lead in, out, and up the wall.' })
  B.building({ id: 'kuraHarbour', kind: 'kura', name: 'Storehouse', x: 75, y: 73, w: 4, h: 5, doorX: 76, text: 'A storehouse full of dried fish. You can smell it through the wall. So can every cat in Ise.' })
  B.building({ id: 'doctor', kind: 'machiya', variant: 'doctor', name: 'Doctor’s house', x: 80, y: 73, w: 6, h: 5, doorX: 82, text: 'The doctor’s house. A sign: "Back soon. If not, boil water anyway."' })
  B.building({ id: 'nagayaD', kind: 'nagaya', name: 'Row houses', x: 87, y: 74, w: 12, h: 4, doorX: 92, text: 'Row houses. Laundry, cats, children, laundry.', litHours: [[1080, 1300]] })
  B.building({
    id: 'ruin',
    kind: 'ruin',
    name: 'Burnt house',
    x: 100,
    y: 74,
    w: 6,
    h: 4,
    doorX: 102,
    text: [
      'A burnt-out house. The neighbours say it was a cooking fire. They say it quickly, and look at the castle.',
      'Among the ashes: a tea kettle, perfectly fine. Kettles survive everything. Kettles, turtles and cockroaches.',
    ],
  })

  // Gardens behind the shops: kura, trees, wells.
  B.building({ id: 'kuraRice', kind: 'kura', name: 'Rice storehouse', x: 37, y: 58, w: 4, h: 5, doorX: 38, text: 'Rice storehouse, padlocked. The padlock is shaped like a fish. Nobody knows why.' })
  for (const [x, y, k] of [
    [44, 60, 'maple'],
    [50, 59, 'pine'],
    [55, 61, 'persimmon'],
    [90, 60, 'maple'],
    [96, 59, 'pine'],
    [100, 61, 'broad'],
    [38, 49, 'pine'],
    [56, 49, 'maple'],
    [41, 38, 'pine'],
    [52, 38, 'maple'],
    [62, 38, 'pine'],
    [89, 47, 'pine'],
    [90, 40, 'pine'],
    [107, 42, 'maple'],
  ] as const)
    B.prop({ kind: 'tree', x, y, variant: k as TreeKind, solid: true })
  for (const [x, y] of [
    [76, 40],
    [47, 49],
    [43, 38],
    [57, 38],
  ])
    B.prop({ kind: 'hydrangea', x, y, solid: true, name: 'Hydrangea', text: 'Hydrangeas. Blue this year. Kiyo says that means the soil is sour. Like Kiyo.' })
  for (const [x, y] of [
    [91, 50],
    [104, 50],
    [96, 47],
    [99, 47],
  ])
    lantern(B, x, y)
  for (const [x, y] of [
    [69, 40],
    [74, 44],
    [69, 52],
    [69, 68],
    [74, 68],
    [69, 76],
    [74, 76],
    [35, 57 - 3],
    [108, 54],
  ])
    lantern(B, x, y)
  B.prop({ kind: 'laundry', x: 60, y: 72, w: 2, solid: true, name: 'Laundry', text: 'Someone’s laundry. A loincloth, a kimono, and a very small kimono.' })
  B.prop({ kind: 'well', x: 94, y: 72, solid: true, name: 'Well', text: 'A neighbourhood well. Somebody dropped a sandal in it. Left foot.' })

  // Places in the city.
  B.place('northGateGuard', 69, 38, 'down')
  B.place('seaGateGuard', 69, 77, 'down')
  B.place('seaGateNight', 69, 85, 'down')
  B.place('westGateGuard', 34, 55, 'right')
  B.place('eastGateGuard', 109, 55, 'left')
  B.place('castleGateGuard', 96, 55, 'down')
  B.place('teaCounter', 79, 49, 'down')
  B.place('teaBench1', 74, 50, 'down')
  B.place('teaBench2', 75, 50, 'down')
  B.place('teaBench3', 80, 50, 'down')
  B.place('teaBench4', 81, 50, 'down')
  B.place('squareBench1', 66, 62, 'down')
  B.place('squareBench2', 67, 62, 'down')
  B.place('fortune', 63, 54, 'down')
  B.place('stall', 67, 59, 'down')
  B.place('fishStall', 63, 50, 'down')
  B.place('vegStall', 66, 50, 'down')
  B.place('fanStall', 76, 58, 'down')
  B.place('potStall', 82, 58, 'down')
  B.place('vegStall2', 62, 58, 'down')
  B.place('squareWell', 78, 61, 'up')
  B.place('notice', 60, 62, 'up')
  B.place('watchtowerFoot', 60, 51, 'down')
  B.place('camphor', 84, 51, 'up')
  B.place('riceFront', 61, 47, 'down')
  B.place('sweetFront', 67, 47, 'down')
  B.place('clothFront', 48, 57, 'down')
  B.place('medicineFront', 55, 57, 'down')
  B.place('bathFront', 40, 57, 'down')
  B.place('smithyFront', 39, 71, 'down')
  B.place('anvil', 37, 70, 'up')
  B.place('carpenterFront', 46, 71, 'down')
  B.place('umbrellaFront', 53, 71, 'down')
  B.place('innFront', 80, 71, 'down')
  B.place('tofuFront', 88, 71, 'down')
  B.place('brewFront', 97, 71, 'down')
  B.place('castleYard', 97, 48, 'down')
  B.place('castleSteps', 98, 47, 'down')
  B.place('stableFront', 106, 51, 'down')
  B.place('inariFront', 81, 41, 'up')
  B.place('southStreetW', 40, 71, 'right')
  B.place('southStreetE', 105, 71, 'left')
  B.place('mainStreetW', 36, 57, 'right')
  B.place('mainStreetE', 106, 57, 'left')
  B.place('samuraiLane', 45, 47, 'right')
  B.place('wallLaneW', 40, 79, 'right')
  B.place('wallLaneE', 104, 79, 'left')
  B.place('kidsCorner', 67, 79, 'down')
  B.place('catFish', 44, 92)
  B.place('catFish2', 46, 93)
  B.place('catFish3', 49, 92)
  B.area('moat', 28, 32, 88, 3, [T.Moat])
  B.area('moatSouth', 28, 82, 88, 3, [T.Moat])
  B.place('catTea', 77, 49)
  B.place('catWell', 79, 61)
  B.place('catInari', 82, 41)
  B.area('square', 58, 48, 28, 16, [T.Stone])
  B.area('teaFront', 73, 48, 13, 3, [T.Stone])
  B.area('brewYard', 91, 70, 13, 2, [T.Road])
  B.area('castleYard', 87, 37, 24, 15, [T.Gravel])
  B.area('southStreet', 33, 70, 78, 2, [T.Road])
  B.area('mainStreet', 33, 56, 78, 2, [T.Road])
  B.area('samuraiLane', 33, 46, 37, 2, [T.Road])
  B.area('carpentry', 43, 70, 20, 2, [T.Road])
}

function stallText(v: string): string[] {
  switch (v) {
    case 'fish':
      return ['A fish stall. Mackerel, sea bream, and one octopus that is definitely still thinking.']
    case 'veg':
      return ['Daikon, eggplant, cucumbers. The cucumbers are suspiciously straight. Kiyo’s, then.']
    case 'fans':
      return ['Folding fans from Kyoto. One shows Mount Fuji. One shows a turtle. You feel seen.']
    default:
      return ['Pots, cups, bowls. A "rare" tea bowl, only slightly broken. Priced as if unbroken.']
  }
}

function lantern(B: Builder, x: number, y: number): void {
  if (B.isTaken(x, y)) return
  B.prop({ kind: 'lantern', x, y, solid: true, name: 'Stone lantern', text: 'A stone lantern. At night a candle burns in it. By day a spider lives in it.' })
}

function rect(x: number, y: number, w: number, h: number) {
  const out: { x: number; y: number }[] = []
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) out.push({ x: i, y: j })
  return out
}

// ---------------------------------------------------------------------------------------------
// The temple on the hill
// ---------------------------------------------------------------------------------------------

function temple(B: Builder): void {
  // Plateau edged by cliffs; the grand staircase down the middle.
  B.fill(43, 21, 58, 5, T.Cliff)
  B.fill(43, 2, 1, 19, T.Cliff)
  B.fill(100, 2, 1, 19, T.Cliff)
  B.fill(70, 21, 4, 5, T.Stairs)
  B.fill(50, 3, 45, 13, T.Gravel)
  B.fill(70, 16, 4, 5, T.Gravel)
  // Temple pond with a red bridge.
  for (let y = 2; y <= 8; y++)
    for (let x = 44; x <= 54; x++) {
      const dx = (x + 0.5 - 49.5) / 4.6
      const dy = (y + 0.5 - 5.5) / 2.8
      if (dx * dx + dy * dy <= 1) B.set(x, y, T.Water)
    }
  B.fill(47, 5, 5, 1, T.Bridge)
  B.prop({ kind: 'redbridge', x: 47, y: 5, w: 5, solid: false, name: 'Red bridge', text: 'A vermilion bridge over the koi pond. The koi follow you, hoping you are bread.' })

  B.building({ id: 'sanmon', kind: 'sanmon', name: 'Sanmon gate', x: 66, y: 16, w: 12, h: 4, door: { x: 71, y: 20 }, open: rect(70, 16, 4, 4), text: ['The temple gate. Two fierce guardian kings glare from the side bays.', 'One is red, one is blue. Both are judging your posture.'] })
  B.building({ id: 'hondo', kind: 'hondo', name: 'Main hall', x: 64, y: 4, w: 16, h: 8, doorX: 71, litHours: [[1050, 1290]], text: ['The main hall of Kōun-ji. Incense, gold leaf, and a very large, very calm Buddha.', 'You bow. Your shell clacks on the floor. The Buddha remains calm.'] })
  B.building({ id: 'pagoda', kind: 'pagoda', name: 'Five-storey pagoda', x: 84, y: 6, w: 5, h: 5, doorX: 86, litHours: [[1080, 1260]], text: ['The five-storey pagoda: earth, water, fire, wind and sky, stacked up.', 'It has survived three earthquakes. It sways. It does not care.'] })
  B.building({ id: 'belltower', kind: 'belltower', name: 'Bell tower', x: 55, y: 7, w: 4, h: 4, doorX: 56, text: ['The great bronze bell. Rung at dawn and dusk.', 'At New Year it’s rung 108 times, once for each worldly desire. Sake is several of them.'] })
  B.building({ id: 'kuri', kind: 'machiya', variant: 'temple', name: 'Monks’ quarters', x: 87, y: 13, w: 8, h: 5, doorX: 90, text: 'The monks’ quarters. Smells of rice and floor polish. Mostly floor polish.' })
  B.building({ id: 'hut', kind: 'hut', name: "Kakuzen's hut", x: 95, y: 3, w: 4, h: 4, doorX: 96, text: 'A sign: "Meditation in progress. Do not disturb." Snoring from inside.' })
  B.prop({ kind: 'incense', x: 71, y: 14, w: 2, solid: true, name: 'Incense burner', text: 'A bronze incense burner. Pilgrims waft the smoke over themselves for health. You waft some onto your shell.' })
  for (const [x, y] of [
    [68, 13],
    [76, 13],
    [68, 15],
    [76, 15],
    [69, 20],
    [74, 20],
  ])
    lantern(B, x, y)
  // Graveyard.
  let k = 0
  for (let y = 12; y <= 19; y += 2)
    for (let x = 45; x <= 53; x += 2) {
      if ((x + y) % 3 === 0) continue
      B.prop({ kind: 'grave', x, y, solid: true, variant: String(k++ % 3), name: 'Grave', text: graveText(k) })
    }
  B.prop({ kind: 'tree', x: 61, y: 13, variant: 'ginkgo', solid: true, name: 'Ginkgo', text: 'A ginkgo older than the temple. In autumn it turns gold. In summer it just looks smug about it.' })
  B.prop({ kind: 'tree', x: 80, y: 14, variant: 'sacred', solid: true })

  B.place('hondoFront', 71, 12, 'up')
  B.place('hondoSide', 74, 13, 'up')
  B.place('bell', 56, 11, 'up')
  B.place('incense', 73, 15, 'up')
  B.place('pagodaFront', 86, 12, 'up')
  B.place('graves', 50, 17, 'up')
  B.place('templePond', 49, 9, 'up')
  B.place('stairsTop', 71, 20, 'down')
  B.place('stairsMid', 72, 23, 'down')
  B.place('stairsBottom', 71, 26, 'down')
  B.place('sanmonFront', 72, 20, 'up')
  B.area('templeGrounds', 50, 3, 45, 13, [T.Gravel])
  B.area('graveyard', 44, 11, 11, 10, [T.Grass])
  B.area('templePond', 44, 2, 11, 7, [T.Water])
  B.area('stairs', 70, 21, 4, 5, [T.Stairs])

  // The approach at the foot of the stairs.
  B.fill(52, 30, 40, 2, T.Road)
  B.building({ id: 'incenseShop', kind: 'shop', variant: 'incense', name: 'Incense & charms', x: 61, y: 26, w: 6, h: 4, doorX: 63, text: 'Charms for luck, health, exams and safe travel. None for turtles. A gap in the market.' })
  B.building({ id: 'dango', kind: 'shop', variant: 'sweets', name: 'Dango stand', x: 77, y: 26, w: 6, h: 4, doorX: 79, text: 'A dango stand for pilgrims who climbed the stairs and regret it.' })
  B.place('dangoFront', 79, 31, 'down')
  lantern(B, 69, 27)
  lantern(B, 74, 27)
}

function graveText(k: number): string {
  const t = [
    'A weathered gravestone. Someone left fresh flowers and a cup of sake. You leave the sake. Respect.',
    'A small grave with a stone frog on top. "Kaeru" means both frog and return home.',
    'An old samurai’s grave. Moss has made it look distinguished.',
    'A merchant’s grave, bigger than the samurai’s. Someone in the family had opinions.',
  ]
  return t[k % t.length]
}

// ---------------------------------------------------------------------------------------------
// Harbour
// ---------------------------------------------------------------------------------------------

function harbour(B: Builder): void {
  B.fill(18, 85, 94, 6, T.Plaza)
  B.fill(18, 91, 94, 2, T.Road)
  B.fill(18, 93, 94, 5, T.Stone)
  B.fill(70, 85, 4, 6, T.Road)
  B.fill(112, 91, 4, 2, T.Bridge)
  B.fill(116, 91, 6, 2, T.Road)
  B.fill(20, 58, 2, 33, T.Road) // farm lane down to the harbour
  // Piers, a breakwater with a lighthouse.
  B.fill(34, 98, 2, 8, T.Pier)
  B.fill(55, 98, 2, 10, T.Pier)
  B.fill(86, 98, 2, 7, T.Pier)
  B.fill(104, 98, 3, 11, T.Stone)

  const wh = (id: string, x: number, name: string, text: string) =>
    B.building({ id, kind: 'kura', variant: 'harbour', name, x, y: 86, w: 7, h: 5, doorX: x + 3, text })
  wh('warehouseW', 22, 'Warehouse', 'A harbour warehouse. Rice from Ise, cotton from Owari, and something marked "DO NOT OPEN (cats)".')
  B.building({ id: 'shipwright', kind: 'shipwright', name: 'Shipwright', x: 30, y: 86, w: 8, h: 5, doorX: 33, text: ['A half-built boat on its frame, like the bones of a whale.', 'Chalked on the hull: "FAST. FOR AN IMPORTANT GUEST. DON’T ASK."'] })
  B.building({ id: 'fishmarket', kind: 'fishmarket', name: 'Fish market', x: 40, y: 87, w: 10, h: 4, doorX: 44, text: ['The fish market. Bonito, sea bream, squid, and a very large tuna nobody can afford.', 'The cats have formed a union.'] })
  B.building({ id: 'tavern', kind: 'tavern', name: 'The Drunken Octopus', x: 51, y: 86, w: 7, h: 5, doorX: 54, text: ['A tavern. Red lanterns, loud sailors, and a sign: "THE DRUNKEN OCTOPUS".', 'The octopus on the sign is, to be fair, drunk.'] })
  B.building({ id: 'office', kind: 'shop', variant: 'harbour', name: 'Harbour office', x: 61, y: 86, w: 6, h: 5, doorX: 63, text: 'The harbour office. A chart of the bay, a tide table, and a list titled "Boats for important guests".' })
  wh('warehouseE1', 76, 'Warehouse', 'A warehouse full of rice bales. The rats here are very well fed and very polite.')
  wh('warehouseE2', 84, 'Warehouse', 'Cotton bales from Owari. Soft. You test one with your face. Very soft.')
  B.building({ id: 'fishhut', kind: 'fishhut', name: "Sanpei's hut", x: 93, y: 87, w: 4, h: 4, doorX: 94, text: 'A board nailed by the door: "BIGGEST CARP: 3 shaku." Someone has crossed it out and written "1".' })
  B.building({ id: 'fishhut2', kind: 'fishhut', name: 'Fisherfolk hut', x: 99, y: 87, w: 4, h: 4, doorX: 100, text: 'A net-mender’s hut. Nets inside, nets outside, nets on the roof.' })
  B.building({ id: 'netshed', kind: 'hut', name: 'Net shed', x: 105, y: 87, w: 4, h: 4, doorX: 106, text: 'A shed of old nets, older ropes, and one ancient boat paddle with teeth marks.' })

  B.prop({ kind: 'ship', x: 58, y: 105, w: 10, h: 4, solid: true, name: 'Merchant ship', text: ['The merchant ship "Ise Maru". A big square sail, a painted eye on the bow.', 'The eye follows you. It’s just paint. Probably.'] })
  B.prop({ kind: 'lighthouse', x: 105, y: 108, solid: true, name: 'Lighthouse', text: ['A stone lighthouse at the end of the breakwater. A fire burns in it all night.', 'Somebody has to climb up there with oil every evening. That somebody complains a lot.'] })
  for (const [x, y] of [
    [37, 101],
    [52, 100],
    [84, 101],
    [90, 99],
    [24, 99],
    [108, 101],
  ])
    B.prop({ kind: 'boat', x, y, solid: true, name: 'Fishing boat', text: 'A fishing boat, rocking gently. It smells of fish and very old decisions.' })
  for (const [x, y, w] of [
    [58, 94, 2],
    [62, 94, 2],
    [75, 95, 2],
    [80, 94, 2],
    [26, 95, 2],
  ])
    B.prop({ kind: 'bales', x, y, w, solid: true, name: 'Rice bales', text: 'Rice bales, waiting for a ship. Each one is a samurai’s pay for a month. You sit on one. Briefly rich.' })
  for (const [x, y] of [
    [66, 94],
    [90, 95],
    [44, 95],
  ])
    B.prop({ kind: 'crates', x, y, solid: true, name: 'Crates', text: 'Crates stamped with a crest you don’t recognise. One rattles. One meows.' })
  B.prop({ kind: 'anchor', x: 48, y: 96, solid: true, name: 'Anchor', text: 'A spare anchor. Heavier than you. Heavier than three of you.' })
  B.prop({ kind: 'nets', x: 97, y: 95, solid: true, name: 'Fishing nets', text: 'Nets drying on poles. One has a sandal in it. Left foot.' })
  B.prop({ kind: 'nets', x: 101, y: 94, solid: true, name: 'Fishing nets', text: 'More nets. The harbour runs on nets and gossip.' })
  B.prop({ kind: 'casks', x: 59, y: 90 - 0, w: 2, solid: true, name: 'Sake casks', text: 'Casks for the tavern. Several are lighter than they should be.' })
  for (const [x, y] of [
    [33, 96],
    [53, 96],
    [69, 96],
    [74, 96],
    [88, 96],
    [103, 96],
  ])
    lantern(B, x, y)
  B.prop({ kind: 'brazier', x: 69, y: 86, solid: true, name: 'Brazier', text: 'An iron fire basket for the night watch at the sea gate. Turtle-roasting warm.' })
  B.prop({ kind: 'brazier', x: 69, y: 29, solid: true, name: 'Brazier', text: 'An iron fire basket by the north bridge. Warm. Very warm.' })

  B.place('pierW', 35, 104, 'down')
  B.place('pierMid', 56, 106, 'down')
  B.place('pierMidFoot', 56, 99, 'down')
  B.place('pierE', 87, 103, 'down')
  B.place('shipSide', 56, 102, 'right')
  B.place('breakwater', 105, 106, 'down')
  B.place('lighthouseFoot', 105, 107, 'up')
  B.place('fishCounter', 43, 91, 'down')
  B.place('fishCounter2', 47, 91, 'down')
  B.place('netMend', 99, 93, 'down')
  B.place('slipway', 33, 92, 'up')
  B.place('tavernFront', 54, 92, 'down')
  B.place('tavernIn1', 56, 92, 'down')
  B.place('officeFront', 63, 92, 'down')
  B.place('quayW', 30, 95, 'down')
  B.place('quayE', 95, 96, 'down')
  B.place('warehouseFront', 80, 92, 'down')
  B.place('harbourStreet', 76, 92, 'down')
  B.area('quay', 18, 93, 94, 5, [T.Stone])
  B.area('harbourStreet', 18, 91, 94, 2, [T.Road])
  B.area('docks', 50, 92, 40, 6, [T.Stone, T.Road])
  B.area('shipwrightYard', 28, 91, 12, 3, [T.Road, T.Stone])
}

// ---------------------------------------------------------------------------------------------
// Farms (west)
// ---------------------------------------------------------------------------------------------

function farms(B: Builder): void {
  B.fill(20, 33, 2, 25, T.Road) // farm lane north
  B.fill(3, 65, 17, 1, T.Road) // Kiyo's lane
  // Paddies.
  for (const cx of [3, 9, 15])
    for (const cy of [34, 38, 42, 46]) {
      const w = cx === 15 ? 4 : 5
      B.fill(cx, cy, w, 3, T.Paddy)
      for (let y = cy; y < cy + 3; y++) for (let x = cx; x < cx + w; x++) if (x < 9 || y < 40) B.planted[idx(x, y)] = 1
    }
  // Fields.
  const fieldBlock = (x: number, y: number, w: number, h: number, crop: number) => {
    B.fill(x, y, w, h, T.Field)
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) B.crops[idx(i, j)] = crop
  }
  fieldBlock(3, 68, 8, 5, CROP.daikon)
  fieldBlock(12, 68, 7, 5, CROP.eggplant)
  fieldBlock(3, 75, 8, 5, CROP.cabbage)
  fieldBlock(12, 75, 7, 5, CROP.cucumber)

  B.building({ id: 'gonbei', kind: 'minka', name: "Gonbei's farmhouse", x: 6, y: 50, w: 7, h: 5, doorX: 9, text: 'Muddy sandals in four sizes. A chewed one in a fifth size: Pochi.' })
  B.building({ id: 'coop', kind: 'coop', name: 'Chicken coop', x: 15, y: 50, w: 3, h: 3, doorX: 16, text: 'The chicken coop. It smells of ambition.' })
  B.building({ id: 'kiyo', kind: 'minkaOld', name: "Kiyo's farmhouse", x: 3, y: 59, w: 6, h: 5, doorX: 5, text: 'A sign: "Turtles will be made into soup." Underneath, smaller: "Eventually."' })
  B.building({ id: 'yasaku', kind: 'cottage', name: "Yasaku's cottage", x: 22, y: 60, w: 6, h: 4, doorX: 24, text: 'A carter’s cottage. A cart outside with one wheel slightly smaller than the other. It goes in circles. Slowly.' })

  const fenceRect = (x0: number, y0: number, x1: number, y1: number, gates: { x: number; y: number }[]) => {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue
        if (gates.some((g) => g.x === x && g.y === y)) continue
        if (B.isTaken(x, y)) continue
        B.prop({ kind: 'fence', x, y, solid: true, name: 'Fence' })
      }
  }
  fenceRect(14, 49, 19, 55, [{ x: 17, y: 55 }])
  fenceRect(10, 58, 16, 64, [{ x: 13, y: 64 }])
  B.prop({ kind: 'trough', x: 11, y: 59, solid: true, name: 'Trough', text: 'Benkei’s trough. Licked clean. Then licked again, just in case.' })
  B.prop({ kind: 'scarecrow', x: 8, y: 41, solid: true, name: 'Scarecrow', text: ['Gonbei’s scarecrow. The crows use it as a perch.', 'It’s had a hard life.'] })
  B.prop({ kind: 'scarecrow', x: 11, y: 73, solid: true, name: 'Scarecrow', text: 'Kiyo’s scarecrow. It’s wearing Kiyo’s old hat. The crows are genuinely afraid of it.' })
  B.prop({ kind: 'hay', x: 17, y: 58, solid: true, name: 'Haystack', text: 'A haystack. Perfect for a nap. You’re a turtle; everything is perfect for a nap.' })
  B.prop({ kind: 'hay', x: 24, y: 66, solid: true, name: 'Haystack', text: 'A haystack. A child-shaped dent in one side. Taro’s "ninja hideout".' })
  B.prop({ kind: 'firewood', x: 2, y: 64 - 1, solid: true, name: 'Firewood', text: 'Firewood, stacked with terrifying precision. Kiyo did this.' })
  B.prop({ kind: 'laundry', x: 3, y: 54, w: 2, solid: true, name: 'Laundry', text: 'Gonbei’s spare loincloth, flapping proudly. You look away respectfully.' })
  B.prop({ kind: 'jizo', x: 22, y: 55, solid: true, name: 'Jizō', text: ['A stone Jizō in a red bib, guardian of travellers.', 'Someone left him a rice ball. You consider it. You leave it. Good turtle.'] })
  B.prop({ kind: 'sign', x: 2, y: 55, solid: true, name: 'Signpost', text: ['← SAKAI. Five days’ walk.', 'For a turtle: next year.'] })
  for (const [x, y, k] of [
    [4, 58, 'persimmon'],
    [24, 72, 'maple'],
    [25, 80, 'pine'],
    [19, 66, 'broad'],
  ] as const)
    B.prop({ kind: 'tree', x, y, variant: k as TreeKind, solid: true })

  // --- the refugee camp: Iga survivors, between the farm lane and the moat ---
  const tentText = (who: string) => [`A tent of patched rice sacks. ${who}`, 'It smells of woodsmoke and wet hemp. Everything out here does.']
  B.building({ id: 'tentA', kind: 'tent', name: 'Tent', x: 22, y: 41, w: 3, h: 2, doorX: 23, text: tentText('Old Sōkyū’s, and Masa’s. Two bedrolls, as far apart as the tent allows.') })
  B.building({ id: 'tentB', kind: 'tent', name: 'Tent', x: 25, y: 44, w: 3, h: 2, doorX: 26, text: tentText('Oshizu’s. Very tidy. Nothing to make untidy.') })
  B.building({ id: 'tentC', kind: 'tent', name: 'Tent', x: 22, y: 48, w: 3, h: 2, doorX: 23, text: tentText('Kotaro has drawn a turtle on it in charcoal. A heroic turtle. With a sword.') })
  B.prop({
    kind: 'campfire',
    x: 26,
    y: 49,
    solid: true,
    name: 'Campfire',
    text: ['The camp’s fire. It never goes out: someone always sits up with it.', 'A pot of something grey bubbles over it. You decide it’s soup. It decides nothing.'],
  })
  B.prop({ kind: 'bedroll', x: 26, y: 42, solid: false, name: 'Bedroll', text: 'A bedroll airing in the open. It has been airing for a week. It is never going to be dry.' })
  B.prop({ kind: 'bedroll', x: 24, y: 52, solid: false, name: 'Bedroll', text: 'A spare bedroll. Spare since winter.' })
  B.prop({ kind: 'grave', x: 27, y: 53, variant: '2', solid: true, name: 'Grave', text: ['A fresh mound with a wooden marker. No name on it. Just: "from Iga".', 'Someone has left a wildflower. Kotaro, probably. He’d deny it.'] })
  B.place('campFireW', 25, 49, 'right')
  B.place('campFireS', 26, 50, 'up')
  B.place('campEdge', 23, 54, 'left')
  B.place('campN', 25, 40, 'up')
  B.area('camp', 22, 40, 6, 15, [T.Grass])

  B.place('gonbeiStep', 10, 55, 'down')
  B.place('callKids', 9, 55, 'down')
  B.place('dogBed', 10, 55)
  B.place('oxGate', 13, 65, 'up')
  B.place('laundryFarm', 4, 55, 'up')
  B.place('kiyoStep', 6, 65, 'down')
  B.place('farmRoad', 18, 57, 'down')
  B.place('westEdge', 0, 56, 'left')
  B.place('beachWestSpot', 10, 92, 'down')
  B.area('paddies', 3, 34, 16, 15, [T.Paddy])
  B.area('fields', 3, 68, 16, 12, [T.Field])
  B.area('chickenYard', 15, 50, 4, 5)
  B.area('oxPen', 11, 59, 5, 5)
  B.area('farmLane', 20, 33, 2, 58, [T.Road])
  B.area('beachWest', 2, 86, 16, 10, [T.Sand])
}

// ---------------------------------------------------------------------------------------------
// East: river, woods, the old shrine
// ---------------------------------------------------------------------------------------------

function east(B: Builder): void {
  B.fill(132, 30, 8, 10, T.Gravel)
  B.building({ id: 'shrine', kind: 'shrine', name: 'Old Kumoi Shrine', x: 132, y: 31, w: 8, h: 5, doorX: 135, text: ['An offering box. You have no coins.', 'You offer a respectful nod instead. The kami nod back. Probably.'] })
  B.fill(135, 40, 2, 16, T.Road)
  B.fill(134, 58, 1, 31, T.Road) // woodland trail down to the east beach
  B.prop({ kind: 'torii', x: 134, y: 43, w: 4, solid: true, name: 'Torii', text: 'The torii of the old shrine. Past it is the kami’s ground. Wipe your feet. All four.' })
  B.prop({ kind: 'komainu', x: 133, y: 38, solid: true, name: 'Komainu', text: 'A stone lion-dog, mouth open: "a". Its partner says "un". Together: everything.' })
  B.prop({ kind: 'komainu', x: 138, y: 38, solid: true, name: 'Komainu', text: 'A stone lion-dog, mouth closed: "un". It has nothing more to say.' })
  lantern(B, 134, 41)
  lantern(B, 137, 41)
  B.prop({ kind: 'sign', x: 141, y: 55, solid: true, name: 'Signpost', text: ['OKAZAKI → Three provinces. Mountains, bandits, ninja.', 'Not recommended for turtles.'] })
  B.place('shrineFront', 136, 37, 'up')
  B.place('eastRoad', 124, 57, 'right')
  B.place('riverbank', riverX(70) + 2, 70, 'left')
  B.area('beachEast', 116, 88, 26, 9, [T.Sand])
  B.area('shrineGrounds', 132, 36, 8, 4, [T.Gravel])
}

// ---------------------------------------------------------------------------------------------
// Roshi's island
// ---------------------------------------------------------------------------------------------

function island(B: Builder): void {
  for (let y = 98; y < B.h; y++)
    for (let x = 118; x < B.w; x++) {
      const dx = (x + 0.5 - 130.5) / 8
      const dy = (y + 0.5 - 104.5) / 4.6
      if (dx * dx + dy * dy <= 1) B.set(x, y, T.Sand)
    }
  B.building({ id: 'kamehouse', kind: 'kamehouse', name: 'Kame House', x: 127, y: 100, w: 6, h: 4, doorX: 129, text: ['KAME HOUSE. Pink walls, red roof, a lifebuoy, and a stack of "reading material" by the door.', 'You do not read the reading material. You are a good turtle.'] })
  B.prop({ kind: 'tree', x: 123, y: 104, variant: 'blackpine', solid: true, name: 'Pine', text: 'A crooked pine. Roshi says he planted it. Roshi says a lot of things.' })
  B.prop({ kind: 'tree', x: 136, y: 102, variant: 'blackpine', solid: true })
  B.prop({ kind: 'sign', x: 134, y: 106, solid: true, name: 'Sign', text: ['"TURTLE SCHOOL. Est. three hundred years ago."', 'Underneath: "Students: 1 (turtle). Fees: sake."'] })
  B.place('roshiChair', 132, 106, 'down')
  B.place('roshiDoor', 129, 104, 'down')
  B.place('roshiShore', 129, 107, 'down')
  B.area('island', 120, 100, 20, 9, [T.Sand])
}

// ---------------------------------------------------------------------------------------------
// Districts and scattered nature
// ---------------------------------------------------------------------------------------------

function districts(B: Builder): void {
  B.district("Roshi's Island", 118, 98, 26, 14)
  B.district('North Gate', 66, 30, 12, 9)
  B.district('Sea Gate', 66, 77, 12, 9)
  B.district('West Gate', 28, 53, 7, 6)
  B.district('Refugee Camp', 22, 39, 6, 16)
  B.district('East Gate', 109, 53, 9, 6)
  B.district('Kōun-ji Temple', 43, 2, 58, 19)
  B.district('The Temple Stairs', 66, 21, 12, 5)
  B.district('Temple Approach', 44, 26, 56, 4)
  B.district('Kumoi Castle', 86, 37, 25, 18)
  B.district('Town Square', 58, 48, 28, 16)
  B.district('Samurai Quarter', 33, 37, 37, 11)
  B.district('Merchant Street', 33, 48, 25, 10)
  B.district('Craftsmen’s Row', 33, 58, 37, 22)
  B.district('Inn & Brewery Street', 74, 58, 37, 22)
  B.district('Fish Market', 38, 85, 13, 12)
  B.district('The Lighthouse', 100, 98, 10, 12)
  B.district('Harbour', 18, 85, 94, 25)
  B.district('Old Kumoi Shrine', 128, 28, 14, 16)
  B.district('Rice Fields', 0, 26, 28, 60)
  B.district('West Beach', 0, 86, 18, 26)
  B.district('East Beach', 116, 84, 28, 14)
  B.district('Eastern Woods', 101, 0, 43, 84)
  B.district('Bamboo Grove', 0, 0, 43, 26)
  B.district('The Moat', 27, 31, 90, 55)
}

function nature(B: Builder): void {
  const r = rng(1582)
  const W = B.w
  const H = B.h
  // Keep scatter off roads, doors and the verges.
  const blocked = new Uint8Array(W * H)
  const block = (x: number, y: number, w = 1, h = 1) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (B.inside(i, j)) blocked[idx(i, j)] = 1
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = B.get(x, y)
      if (B.taken[idx(x, y)]) block(x - 1, y - 1, 3, 3)
      if (t !== T.Grass && t !== T.Forest && t !== T.Sand) block(x, y)
      if (t === T.Road || t === T.Plaza || t === T.Stone || t === T.Bridge || t === T.Gravel || t === T.Stairs) block(x - 1, y - 1, 3, 3)
    }
  for (const b of B.buildings) block(b.door.x - 1, b.door.y, 3, 2)
  for (const p of Object.values(B.places)) block(p.x - 1, p.y - 1, 3, 3)
  for (const a of Object.values(B.areas)) if (!a.only || a.only.includes(T.Grass)) block(a.x, a.y, a.w, a.h)
  // Inside the city walls only the hand-placed gardens.
  block(WX0, WY0, WX1 - WX0 + 1, WY1 - WY0 + 1)

  const tree = (x: number, y: number, v: TreeKind, solid = true) => {
    B.prop({ kind: 'tree', x, y, variant: v, solid })
    block(x, y)
  }
  const zone = (x0: number, y0: number, x1: number, y1: number, density: number, kinds: TreeKind[], ground: number[] = [T.Grass]) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        if (blocked[idx(x, y)] || !ground.includes(B.get(x, y))) continue
        if (r() < density) tree(x, y, kinds[Math.floor(r() * kinds.length)])
      }
  }
  // Temple hill: cedars around the precinct.
  zone(44, 2, 49, 20, 0.35, ['cedar'])
  zone(94, 8, 99, 20, 0.45, ['cedar'])
  zone(56, 16, 65, 20, 0.35, ['cedar', 'maple'])
  zone(78, 16, 86, 20, 0.35, ['cedar', 'maple'])
  // Bamboo grove north-west, woods north-east and east.
  for (let y = 2; y <= 24; y++)
    for (let x = 2; x <= 41; x++) {
      if (blocked[idx(x, y)] || B.get(x, y) !== T.Grass) continue
      if (r() < (x < 30 ? 0.55 : 0.3)) {
        B.prop({ kind: 'bamboo', x, y, solid: true })
        block(x, y)
      }
    }
  zone(101, 2, 141, 29, 0.35, ['cedar', 'broad', 'broad', 'pine'])
  zone(116, 30, 141, 84, 0.33, ['broad', 'broad', 'maple', 'cedar', 'pine'])
  zone(2, 25, 27, 32, 0.25, ['broad', 'maple', 'pine'])
  zone(44, 26, 99, 29, 0.25, ['maple', 'pine', 'broad'])
  // Black pines along the beaches.
  zone(2, 84, 17, 96, 0.12, ['blackpine'], [T.Sand, T.Grass])
  zone(116, 84, 141, 96, 0.1, ['blackpine'], [T.Sand, T.Grass])
  // Forest band trees (decoration; the band itself blocks movement).
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (B.get(x, y) !== T.Forest) continue
      const nearRoad = [-1, 0, 1].some((d) => B.get(x, y + d) === T.Road || B.get(x + d, y) === T.Road)
      if (nearRoad || r() > 0.62) continue
      B.prop({ kind: 'tree', x, y, variant: y < 2 ? 'cedar' : r() < 0.5 ? 'broad' : 'pine', solid: false })
    }
  // Bushes and rocks on leftover grass outside the walls.
  for (let y = 2; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      if (blocked[idx(x, y)] || B.get(x, y) !== T.Grass) continue
      const v = r()
      if (v < 0.03) {
        B.prop({ kind: 'bush', x, y, solid: true, name: 'Bush', text: 'A bush. It rustles. Probably a ninja. Probably a sparrow.' })
        block(x - 1, y - 1, 3, 3)
      } else if (v < 0.042) {
        B.prop({ kind: 'rock', x, y, solid: true, name: 'Rock', text: 'A mossy rock. You feel a certain kinship.' })
        block(x - 1, y - 1, 3, 3)
      }
    }
  // Reeds along the river; irises by the temple pond.
  for (let y = 2; y < 96; y++) {
    const c = riverX(y)
    for (const x of [c - 2, c + 2]) if (B.get(x, y) === T.Grass && !B.isTaken(x, y) && r() < 0.35) B.prop({ kind: 'reeds', x, y, solid: false })
  }
  for (let y = 2; y <= 9; y++)
    for (let x = 44; x <= 55; x++) {
      if (B.get(x, y) !== T.Grass || B.isTaken(x, y)) continue
      const wet = [B.get(x + 1, y), B.get(x - 1, y), B.get(x, y + 1), B.get(x, y - 1)].includes(T.Water)
      if (wet && r() < 0.5) B.prop({ kind: 'iris', x, y, solid: false })
    }
}
