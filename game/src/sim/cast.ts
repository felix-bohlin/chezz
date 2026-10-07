// The people of Kumoi village: how they look, where they go each day, and what they say.
// Pure data. Times are game time ("HH:MM"); a day is 24 game hours, see sim/clock.ts.
//
// Schedule entries are resolved like a timetable: the latest entry whose time has passed is what
// the villager is doing now (wrapping past midnight). `days: 'market'` entries only count on
// market days (every third day, starting with day 1).

export type Pose =
  | 'stand'
  | 'sit'
  | 'plant'
  | 'hoe'
  | 'sweep'
  | 'fish'
  | 'chant'
  | 'conch'
  | 'nap'
  | 'feed'
  | 'call'
  | 'shop'
  | 'serve'
  | 'guard'
  | 'alms'
  | 'carry'
  | 'tend'
  | 'play'
  | 'meditate'

export type Doing =
  | { kind: 'inside'; lit: boolean }
  | { kind: 'spot'; at: string; pose: Pose }
  | { kind: 'area'; area: string; pose: Pose; style: 'work' | 'wander' | 'chase' }
  | { kind: 'patrol'; route: string[] }

export interface Entry {
  at: string
  /** Shown on the map's who's-where list, e.g. "planting rice". */
  label: string
  doing: Doing
  /** Said once when this entry starts (if the turtle is near, or always when `shout`). */
  say?: string
  shout?: boolean
  days?: 'market'
}

export type Hair = 'topknot' | 'bun' | 'grayBun' | 'kidBoy' | 'kidGirl' | 'bald' | 'short'
export type Hat = 'kasa' | 'jingasa' | 'tokin' | 'hachimaki' | 'tenugui'
export type Extra = 'armor' | 'apron' | 'pompoms' | 'backpack' | 'banner' | 'happi' | 'creel'

export interface Look {
  kid?: boolean
  hair: Hair
  hairColor?: string
  hat?: Hat
  robe: string
  robeShade: string
  sash: string
  collar?: string
  legs?: string
  extras?: Extra[]
}

export interface VillagerSpec {
  id: string
  name: string
  title: string
  /** Place they go in and out of: a door, or the edge of the map for travellers. */
  home: string
  look: Look
  /** Walking speed in px per second at 1× time. */
  speed: number
  /** Dot colour on the map. */
  color: string
  schedule: Entry[]
  talk: string[]
  /** First time the turtle walks up. */
  turtle: string[]
  /** When the turtle hides in its shell next to them. */
  shell: string[]
  night?: string[]
  barks: Partial<Record<Pose | 'walk', string[]>>
}

const inside = (lit = true): Doing => ({ kind: 'inside', lit })
const spot = (at: string, pose: Pose = 'stand'): Doing => ({ kind: 'spot', at, pose })
const work = (area: string, pose: Pose): Doing => ({ kind: 'area', area, pose, style: 'work' })
const wander = (area: string, pose: Pose = 'stand'): Doing => ({ kind: 'area', area, pose, style: 'wander' })

export const CAST: VillagerSpec[] = [
  {
    id: 'gonbei',
    name: 'Gonbei',
    title: 'rice farmer',
    home: 'door:gonbei',
    color: '#3a5a9a',
    speed: 30,
    look: { hair: 'topknot', hat: 'kasa', robe: '#3c5788', robeShade: '#2b3f66', sash: '#c9b58a', legs: '#3c5788', collar: '#e8e0cc' },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '05:20', label: 'stretching', doing: spot('gonbeiStep'), say: 'Another day, another thousand seedlings. Ow, my back.' },
      { at: '05:40', label: 'planting rice', doing: work('paddies', 'plant') },
      { at: '11:30', label: 'lunch at home', doing: inside() },
      { at: '12:30', label: 'planting rice', doing: work('paddies', 'plant') },
      { at: '17:30', label: 'drinking tea (allegedly)', doing: spot('teaBench1', 'sit') },
      { at: '19:40', label: 'home for dinner', doing: inside() },
      { at: '21:30', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Gonbei sows the seeds, the crows dig them up. They made a proverb about me. Nobody asked me.',
      'A turtle in my paddy is good luck. A crow in my paddy is a crow.',
      'They say turtles live ten thousand years. Must be nice. My knees are forty and already retired.',
      'Ohana plants faster than me. Don’t tell her I said so. She knows.',
      'Sake for the hermit on the island? Kurozaemon guards that brewery like Lord Nobunaga guards his tea bowls.',
    ],
    turtle: ['Oh! A turtle! Lucky day!', 'A turtle in the village? That’s ten thousand years of luck. I’ll take some.'],
    shell: ['Huh. Was that rock always there?', 'Good rock. Solid rock.'],
    night: ['It’s late, little turtle. Even the crows are asleep. Well. Pretending.'],
    barks: {
      plant: ['One seedling… two seedlings…', 'Ow. My back.', 'Shoo! SHOO! Filthy crows!', 'Rows straight as an arrow. Mostly.', 'Mud between my toes. The farmer’s perfume.'],
      sit: ['One cup. Then home. …Two cups.', 'Ahh. The crows can’t follow me here.'],
    },
  },
  {
    id: 'ohana',
    name: 'Ohana',
    title: 'Gonbei’s wife',
    home: 'door:gonbei',
    color: '#c96a3a',
    speed: 32,
    look: { hair: 'bun', hat: 'tenugui', robe: '#b8613a', robeShade: '#8e4528', sash: '#2f3f73', legs: '#3d3449', collar: '#f1e6cc' },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '05:35', label: 'feeding the hens', doing: { kind: 'area', area: 'chickenYard', pose: 'feed', style: 'wander' } },
      { at: '06:50', label: 'drawing water', doing: spot('well') },
      { at: '07:20', label: 'planting rice', doing: work('paddies', 'plant') },
      { at: '11:00', label: 'cooking lunch', doing: inside() },
      { at: '12:20', label: 'hanging laundry', doing: spot('laundry') },
      { at: '13:10', label: 'planting rice', doing: work('paddies', 'plant') },
      { at: '17:00', label: 'calling the children', doing: spot('callKids', 'call'), say: 'TARO! KIKU! DINNER!', shout: true },
      { at: '17:30', label: 'cooking dinner', doing: inside() },
      { at: '21:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Gonbei talks to the crows. The crows talk back. Neither one listens.',
      'Eggs, rice, laundry, two children and a dog. And now a turtle. Wipe your feet.',
      'The hens like you. They like anything slower than them.',
      'Sake for the hermit on the island? He still owes the brewery. Since my grandmother’s grandmother.',
    ],
    turtle: ['A turtle! Children, don’t— too late, they’ve seen it.'],
    shell: ['Who left a rock in my yard?'],
    barks: {
      feed: ['Here, chick-chick-chick!', 'Not you, rooster. Ladies first.', 'Nobunaga! Share!'],
      plant: ['Faster, Gonbei, the sun won’t wait.', 'Plant, step, plant, step…'],
      call: ['If I count to ten… ONE…', 'TARO! KIKU!'],
      stand: ['Hmm-hm-hmm…'],
    },
  },
  {
    id: 'taro',
    name: 'Taro',
    title: 'future ninja (self-declared)',
    home: 'door:gonbei',
    color: '#5f9a4a',
    speed: 44,
    look: { kid: true, hair: 'kidBoy', robe: '#5f8f5a', robeShade: '#456c42', sash: '#e0b13c', legs: '#f2c9a0' },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '06:30', label: 'chasing chickens', doing: { kind: 'area', area: 'chickenYard', pose: 'play', style: 'chase' } },
      { at: '08:00', label: 'ninja training by the pond', doing: wander('pondShore', 'play') },
      { at: '11:00', label: 'lunch', doing: inside() },
      { at: '12:00', label: 'playing in the square', doing: wander('square', 'play') },
      { at: '14:00', label: 'hiding in the haystacks', doing: wander('meadow', 'play') },
      { at: '16:00', label: 'chasing chickens', doing: { kind: 'area', area: 'chickenYard', pose: 'play', style: 'chase' } },
      { at: '17:15', label: 'home for dinner', doing: inside() },
      { at: '20:30', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'I’m going to be a ninja. I already know how to be quiet. Watch. … …See?',
      'Kiku says turtles can’t be ninja. You’re a ninja, right? Blink twice.',
      'Mother says Iga ninja are just farmers with good shoes.',
      'Pochi caught a chicken once. Then the chicken caught Pochi.',
    ],
    turtle: ['A TURTLE! Kiku! KIKU! A TURTLE!', 'Can I ride you? I’m small. Mostly.'],
    shell: ['It went into its house! Hello? Anybody home?'],
    barks: { play: ['Hyaa! Ninja leap!', 'Get the chicken!', 'You can’t see me, I’m in the shadows!', 'Shuriken! Shhhk!'] },
  },
  {
    id: 'kiku',
    name: 'Kiku',
    title: 'Taro’s little sister, the boss',
    home: 'door:gonbei',
    color: '#d0505a',
    speed: 40,
    look: { kid: true, hair: 'kidGirl', robe: '#d0505a', robeShade: '#a33a44', sash: '#f1e6cc', legs: '#f2c9a0' },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '06:40', label: 'chasing a hen called Nobunaga', doing: { kind: 'area', area: 'chickenYard', pose: 'play', style: 'chase' } },
      { at: '08:10', label: 'catching frogs by the pond', doing: wander('pondShore', 'play') },
      { at: '11:00', label: 'lunch', doing: inside() },
      { at: '12:10', label: 'bossing Taro around', doing: wander('square', 'play') },
      { at: '14:00', label: 'in the meadow', doing: wander('meadow', 'play') },
      { at: '16:10', label: 'chasing Nobunaga the hen', doing: { kind: 'area', area: 'chickenYard', pose: 'play', style: 'chase' } },
      { at: '17:15', label: 'home for dinner', doing: inside() },
      { at: '20:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'My brother is not a ninja. He fell in the pond twice. Today.',
      'Turtles live ten thousand years. I’ll still be your friend when I’m a hundred.',
      'I named the bossy hen Nobunaga. She pecks everybody and nobody stops her.',
      'When I grow up I’m going to run the teahouse. And the village. And Taro.',
    ],
    turtle: ['Hi turtle! Do you want to be my turtle?', 'Taro, look! No, MY turtle. I saw it first.'],
    shell: ['Knock knock! …Rude.'],
    barks: { play: ['Taro, you’re doing it wrong!', 'Come back, Nobunaga!', 'Ribbit! I caught one! It caught me!'] },
  },
  {
    id: 'kiyo',
    name: 'Kiyo',
    title: 'farmer, sixty years and counting',
    home: 'door:kiyo',
    color: '#8a6a50',
    speed: 22,
    look: { hair: 'grayBun', hat: 'tenugui', robe: '#7a5a42', robeShade: '#5a412e', sash: '#3d3449', legs: '#3d3449', collar: '#c9c1b0' },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '04:50', label: 'weeding the fields', doing: work('fields', 'hoe') },
      { at: '09:00', label: 'feeding Benkei the ox', doing: spot('oxGate', 'tend') },
      { at: '09:40', label: 'weeding the fields', doing: work('fields', 'hoe') },
      { at: '12:00', label: 'lunch', doing: inside() },
      { at: '13:30', label: 'gossiping at the teahouse', doing: spot('teaBench2', 'sit') },
      { at: '15:30', label: 'weeding the fields', doing: work('fields', 'hoe') },
      { at: '18:00', label: 'at home', doing: inside() },
      { at: '20:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Sixty years I’ve weeded this field. The weeds are winning on points.',
      'I was going to make you into soup. Then I remembered I’m too tired to chase anything. Even you.',
      'That old hermit on the island courted me once. I said no. He’s been sulking on that island for fifty years.',
      'My ox is called Benkei. Strongest in the village and twice as stubborn as me. Almost.',
    ],
    turtle: ['Hmph. A turtle. Faster than the last tax collector.'],
    shell: ['Don’t think I can’t see you, turtle. I’m old, not blind.'],
    barks: {
      hoe: ['Hmph.', 'Weeds. Always weeds.', 'My back says it’s going to rain. My back is a liar.'],
      sit: ['Oume, did you hear about the brewer’s nephew…', 'Tea’s weak today. Like the young people.'],
      tend: ['Eat, Benkei. You’re not getting any prettier.'],
    },
  },
  {
    id: 'oume',
    name: 'Oume',
    title: 'teahouse keeper, gossip merchant',
    home: 'door:teahouse',
    color: '#9a3f62',
    speed: 28,
    look: { hair: 'bun', robe: '#8a3f5a', robeShade: '#682e44', sash: '#e0b13c', legs: '#3d3449', collar: '#f1e6cc', extras: ['apron'] },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '06:00', label: 'sweeping the front', doing: { kind: 'area', area: 'teaFront', pose: 'sweep', style: 'wander' } },
      { at: '07:00', label: 'serving tea', doing: spot('teaCounter', 'serve'), say: 'Teahouse is open! Tea, dango, gossip!' },
      { at: '21:00', label: 'counting the day’s coins', doing: inside() },
      { at: '23:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Welcome, welcome! Tea? Dango? Gossip? The gossip is free.',
      'Did you hear? Lord Nobunaga is staying at Honnō-ji in Kyoto with hardly any guards. What could possibly go wrong?',
      'Heisuke had four dango yesterday on his "five-minute break". Four!',
      'Kurozaemon won’t sell to the island hermit. Unpaid tab. Three hundred years of it.',
      'You don’t talk? Even better. You’ll keep all my secrets.',
    ],
    turtle: ['Oh my! A guest with a shell! Sit anywhere, dear!'],
    shell: ['Ara, a decorative stone. How tasteful.'],
    barks: {
      serve: ['Tea’s hot! Mind your shell.', 'Dango! Fresh dango!', 'Another cup, Gonbei? Of course another cup.', 'Ara ara… did you hear about…'],
      sweep: ['Sweep, sweep. The dust always comes back. So do the customers.'],
    },
  },
  {
    id: 'kurozaemon',
    name: 'Kurozaemon',
    title: 'master brewer',
    home: 'door:brewery',
    color: '#d8d0b8',
    speed: 28,
    look: { hair: 'topknot', hat: 'hachimaki', robe: '#e7e0cf', robeShade: '#bdb39c', sash: '#2f3f73', legs: '#2f3f73', collar: '#2f3f73', extras: ['happi'] },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '04:30', label: 'brewing (inside, steaming)', doing: inside() },
      { at: '07:00', label: 'hauling casks', doing: work('brewYard', 'carry') },
      { at: '12:00', label: 'lunch at the teahouse', doing: spot('teaBench3', 'sit') },
      { at: '13:00', label: 'hauling casks', doing: work('brewYard', 'carry') },
      { at: '16:00', label: 'tasting (quality control)', doing: inside() },
      { at: '19:00', label: '"research" at the teahouse', doing: spot('teaBench2', 'sit') },
      { at: '21:00', label: 'at home', doing: inside() },
      { at: '22:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Best sake in Iga. Do not tell me Kōka has better sake. Kōka has better LIARS.',
      'The island hermit? His tab is older than my grandfather. NO sake for his errand turtle.',
      'Green cedar ball: the new sake is ready. Brown: the sake is perfect. Fallen off: I drank it.',
      'No turtles in the brewery. The last turtle in the brewery… we don’t talk about the last turtle.',
    ],
    turtle: ['You! Turtle! I know who sent you!', 'Keep your flippers off my casks.'],
    shell: ['A rock. Next to my casks. Suspicious rock.'],
    barks: {
      carry: ['Hup!', 'Mind the cask!', 'This one’s for a lord’s table. Allegedly.'],
      sit: ['Aah. Somebody else’s sake. Professional research.'],
    },
  },
  {
    id: 'kakuzen',
    name: 'Kakuzen',
    title: 'mountain monk (yamabushi)',
    home: 'door:hut',
    color: '#e0d6b0',
    speed: 26,
    look: { hair: 'bald', hat: 'tokin', robe: '#e2d8b4', robeShade: '#b9ad86', sash: '#6a4a8a', legs: '#e2d8b4', collar: '#c0262f', extras: ['pompoms'] },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '05:50', label: 'blowing the conch', doing: spot('shrineFront', 'conch') },
      { at: '06:15', label: 'raking the gravel', doing: { kind: 'area', area: 'shrineGrounds', pose: 'sweep', style: 'wander' } },
      { at: '08:00', label: 'chanting sutras', doing: spot('shrineFront', 'chant') },
      { at: '11:00', label: 'begging alms in the square', doing: spot('alms', 'alms') },
      { at: '13:00', label: '"meditating" (napping)', doing: spot('shrineFront', 'nap') },
      { at: '15:00', label: 'meditating by the pond', doing: spot('meditate', 'meditate') },
      { at: '17:30', label: 'evening sutras', doing: spot('shrineFront', 'chant') },
      { at: '19:00', label: 'in his hut', doing: inside() },
      { at: '21:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'I am a yamabushi. I sleep on mountains. Sometimes in the middle of sweeping.',
      'The rooster and I compete every dawn. I have the conch. He has no shame.',
      'Every being has the Buddha nature. Even crows. Gonbei disagrees.',
      'Patience is the root of safety. Also of naps.',
    ],
    turtle: ['Ah. The turtle carries its home. Very wise. Very slow.'],
    shell: ['The turtle withdraws from the world. I respect that. I envy that.'],
    barks: {
      conch: ['BWOOOOOOOO!'],
      chant: ['Namu Amida Butsu…', 'On abira unken sowaka…', 'Hmmmmmm…'],
      sweep: ['One leaf. Another leaf. Enlightenment is one leaf away.'],
      nap: ['Zzz… I’m meditating… zzz…'],
      alms: ['Alms for a humble monk? Rice? Coin? Sake?'],
      meditate: ['The pond is still. The mind is still. The stomach is not.'],
    },
  },
  {
    id: 'heisuke',
    name: 'Heisuke',
    title: 'village guard (ashigaru)',
    home: 'door:guard',
    color: '#c0262f',
    speed: 32,
    look: { hair: 'topknot', hat: 'jingasa', robe: '#3d3449', robeShade: '#2a2233', sash: '#c0262f', legs: '#3d3449', collar: '#c0262f', extras: ['armor', 'banner'] },
    schedule: [
      { at: '00:00', label: 'night watch at the bridge', doing: spot('bridgeWest', 'guard') },
      { at: '02:00', label: 'asleep', doing: inside(false) },
      { at: '07:00', label: 'patrolling', doing: { kind: 'patrol', route: ['bridgeWest', 'patrolA', 'patrolD', 'patrolC', 'patrolB'] } },
      { at: '12:00', label: 'lunch (vigilantly)', doing: spot('teaBench4', 'sit') },
      { at: '13:00', label: 'patrolling', doing: { kind: 'patrol', route: ['patrolB', 'patrolC', 'patrolD', 'patrolA', 'bridgeWest'] } },
      { at: '15:00', label: 'a five-minute dango break', doing: spot('teaBench1', 'sit') },
      { at: '16:10', label: 'patrolling', doing: { kind: 'patrol', route: ['bridgeWest', 'patrolA', 'patrolD', 'patrolC', 'patrolB'] } },
      { at: '18:30', label: 'dinner at the guard post', doing: inside() },
      { at: '20:00', label: 'night watch at the bridge', doing: spot('bridgeWest', 'guard'), say: 'Night watch! Nobody crosses without… asking nicely.' },
    ],
    talk: [
      'I’m the guard. Of the bridge. And the village. Mostly the bridge.',
      'One day I’ll have real armour. Lacquered. With a big crest. A moon. Or a turtle!',
      'If anyone asks, I’ve been guarding all day. Especially at the teahouse.',
      'They say there are Akechi soldiers on the roads. I’m not scared. You’re scared.',
    ],
    turtle: ['HALT! …It’s a turtle. Stand down, Heisuke.', 'Are you an Akechi spy? Blink once for no.'],
    shell: ['It’s a trap. Rocks don’t sweat.'],
    night: ['Who’s there?! …The wind. Good. Good wind.'],
    barks: {
      guard: ['Halt! Who goes— oh. Nobody.', 'Nothing to report. Except that frog.', 'The bridge is secure. I checked it. Twice.'],
      stand: ['Left, right, left… was it left?', 'All quiet. Suspiciously quiet.'],
      walk: ['Left, right, left…', 'All quiet. Suspiciously quiet.'],
      sit: ['Just one dango. For vigilance.'],
    },
  },
  {
    id: 'sanpei',
    name: 'Sanpei',
    title: 'fisherman, teller of tall tales',
    home: 'door:fishhut',
    color: '#6f9fbf',
    speed: 28,
    look: { hair: 'short', hat: 'kasa', robe: '#6f9fbf', robeShade: '#4f7f9f', sash: '#7a5a42', legs: '#f2c9a0', collar: '#e8e0cc', extras: ['creel'] },
    schedule: [
      { at: '00:00', label: 'asleep', doing: inside(false) },
      { at: '04:30', label: 'fishing off the pier', doing: spot('pierEnd', 'fish') },
      { at: '10:00', label: 'selling fish in the square', doing: spot('fishStand', 'shop'), say: 'Fresh sweetfish! Caught this morning! Some of it!' },
      { at: '12:00', label: 'lunch', doing: inside() },
      { at: '13:00', label: 'fishing by the bridge', doing: spot('riverbank', 'fish') },
      { at: '17:00', label: 'fishing off the pier', doing: spot('pierEnd', 'fish') },
      { at: '19:00', label: 'telling fish stories', doing: spot('teaBench3', 'sit') },
      { at: '21:00', label: 'at home', doing: inside() },
      { at: '22:00', label: 'asleep', doing: inside(false) },
    ],
    talk: [
      'Yesterday I caught a carp THIS big. It got away. It was bigger.',
      'The river talks if you listen. Mostly it says "no fish today".',
      'You swim? Good. Tell the fish I’m a nice man.',
    ],
    turtle: ['A swimmer! Don’t eat my bait.'],
    shell: ['Hm. Good shape for an anchor.'],
    barks: {
      fish: ['Bite… bite… bite…', 'Got one! …It’s a sandal.', 'Shh. You’ll scare the fish.'],
      shop: ['Sweetfish! Fresh-ish!', 'This one fought like a samurai!'],
      sit: ['…and THEN the carp says—', 'It was THIS big. No. THIS big.'],
    },
  },
  {
    id: 'jinbei',
    name: 'Jinbei',
    title: 'travelling peddler (market days)',
    home: 'westEdge',
    color: '#b08a50',
    speed: 28,
    look: { hair: 'topknot', hat: 'kasa', robe: '#8a6a40', robeShade: '#6a4f2e', sash: '#3d3449', legs: '#3d3449', collar: '#e8e0cc', extras: ['backpack'] },
    schedule: [
      { at: '00:00', label: 'on the road', doing: inside() },
      { at: '07:30', label: 'selling at the market', doing: spot('stall', 'shop'), days: 'market', say: 'Market day! Combs from Kyoto! Fans from Sakai! Rumours from everywhere!', shout: true },
      { at: '16:00', label: 'resting his feet', doing: spot('teaBench4', 'sit'), days: 'market' },
      { at: '17:00', label: 'on the road to Sakai', doing: inside(), days: 'market' },
    ],
    talk: [
      'Combs from Kyoto! Fans from Sakai! Rumours from everywhere!',
      'I hear the capital is restless. Bad for business. Good for gossip.',
      'A turtle-shell comb? No offence. Purely hypothetical.',
      'I walked from Sakai. Five days. You’d take… a while.',
    ],
    turtle: ['A customer with a shell! I have just the polishing cloth.'],
    shell: ['Excellent stone. I could sell this.'],
    barks: {
      shop: ['Fans! Combs! Needles! A rare tea bowl, only slightly broken!', 'Everything must go! Including me, at five.'],
      sit: ['My feet have walked to Kyoto and back. They want a divorce.'],
    },
  },
]

/** Generic reactions when a villager has none of their own. */
export const GENERIC_SHELL = ['A rock?', 'That rock is breathing.']
