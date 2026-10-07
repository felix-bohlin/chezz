// Passers-by: anonymous townsfolk who make the streets busy. They wander between shops, the
// square, the harbour and the temple by day and go home at dusk. Generated deterministically.
// They aren't on the map's who's-where list (spec.extra).

import { rng, pick, type Rng } from '../engine/rng'
import { asleep, home, patrol, type Hair, type Hat, type Look, type VillagerSpec } from './types'

const SPOTS = {
  town: ['squareWell', 'notice', 'fishStall', 'vegStall', 'fanStall', 'potStall', 'camphor', 'watchtowerFoot', 'riceFront', 'sweetFront', 'clothFront', 'medicineFront', 'bathFront', 'innFront', 'tofuFront', 'brewFront', 'smithyFront', 'carpenterFront', 'umbrellaFront', 'inariFront', 'mainStreetW', 'mainStreetE', 'southStreetW', 'southStreetE', 'samuraiLane'],
  harbour: ['officeFront', 'warehouseFront', 'tavernFront', 'fishCounter', 'fishCounter2', 'quayW', 'quayE', 'pierMidFoot', 'harbourStreet', 'slipway'],
  temple: ['hondoFront', 'incense', 'graves', 'pagodaFront', 'dangoFront', 'stairsBottom', 'stairsTop', 'sanmonFront', 'templePond'],
  farm: ['farmRoad', 'gonbeiStep', 'oxGate', 'shrineFront', 'eastRoad'],
  camp: ['campFireW', 'campFireS', 'campEdge', 'campN', 'farmRoad', 'westGateGuard'],
}

interface Role {
  title: string
  names: string[]
  homes: string[]
  haunts: (keyof typeof SPOTS)[]
  look: (r: Rng) => Look
  talk: string[]
}

const ROBES = ['#5a6a7a', '#7a5a42', '#4a6a5a', '#8a6a4a', '#5a4a6a', '#6a7a8a', '#8a5a5a', '#4a5a7a', '#7a7050']
const shade = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.75)
  return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const commoner = (r: Rng, hair: Hair, hat?: Hat, extras: Look['extras'] = []): Look => {
  const robe = pick(r, ROBES)
  return { hair, hat, robe, robeShade: shade(robe), sash: pick(r, ['#3d3449', '#c9b58a', '#2f3f73', '#8a5a3a']), legs: pick(r, ['#3d3449', '#f2c9a0']), collar: '#e8e0cc', extras }
}

const ROLES: Role[] = [
  {
    title: 'pilgrim to Kōun-ji',
    names: ['A pilgrim', 'A tired pilgrim', 'A pilgrim from Owari'],
    homes: ['door:inn', 'westEdge'],
    haunts: ['temple', 'temple', 'town'],
    look: (r) => ({ hair: 'short', hat: 'kasa', robe: '#ece6d6', robeShade: '#c8c0aa', sash: pick(r, ['#c0262f', '#2f3f73']), legs: '#ece6d6', collar: '#ece6d6' }),
    talk: [
      'One hundred and eight steps. I counted one hundred and nine. Either I’m wrong or the temple is growing.',
      'I walked from Owari to pray for my husband’s back. Now my back needs praying for.',
      'They say if you rub the turtle’s shell you get ten thousand years. …May I? No? Fair.',
    ],
  },
  {
    title: 'rōnin (between lords)',
    names: ['A rōnin', 'A masterless samurai', 'A scruffy rōnin'],
    homes: ['door:inn', 'door:nagayaA'],
    haunts: ['town', 'harbour'],
    look: (r) => ({ ...commoner(r, 'topknot'), robe: '#4a4a4a', robeShade: '#363636', extras: ['swords'] }),
    talk: [
      'My lord fell, my house fell, my sandals are next. I am a rōnin. It means "wave man". I go where I’m pushed.',
      'I’m not lurking. I’m waiting with intent.',
      'If a great lord needs a sword in a hurry, I’m available. Discreet. Cheap. Hungry.',
      'I have killed eleven men. None of them were my idea.',
    ],
  },
  {
    title: 'merchant',
    names: ['A merchant', 'A rice broker', 'A merchant from Sakai'],
    homes: ['door:inn', 'door:nagayaD'],
    haunts: ['town', 'harbour', 'harbour'],
    look: (r) => commoner(r, 'topknot', undefined, ['apron']),
    talk: [
      'Buy low, sell high, and never lend money to a samurai. Those are the three rules.',
      'The captain says his ship is the fastest in Ise. Everyone says that. Ships are like grandchildren.',
      'Ten coppers for a rumour from Kyoto? I’ll wait. Rumours always get cheaper.',
      'War is very good for business. Not for the people in it. But they aren’t my customers.',
    ],
  },
  {
    title: 'townswoman',
    names: ['A townswoman', 'A busy mother', 'A neighbour'],
    homes: ['door:nagayaA', 'door:nagayaB', 'door:nagayaC', 'door:nagayaD'],
    haunts: ['town', 'town', 'harbour'],
    look: (r) => commoner(r, pick(r, ['bun', 'bun', 'grayBun'] as Hair[]), pick(r, [undefined, 'tenugui'] as (Hat | undefined)[])),
    talk: [
      'Tofu, radishes, a fish for dinner, and my son, wherever he is. That’s my morning.',
      'Did you hear? Oume says the harbour master is hiding a boat. Oume says a lot of things. Usually true.',
      'A turtle in the street! My grandmother said it means a long life. My grandmother lived to forty.',
      'Don’t go out of the West Gate after dark. Those Iga people have nothing. People with nothing… well. You hear things.',
    ],
  },
  {
    title: 'porter',
    names: ['A porter', 'A dock hand', 'A carrier'],
    homes: ['door:nagayaC', 'door:nagayaD'],
    haunts: ['harbour', 'harbour', 'town'],
    look: (r) => ({ ...commoner(r, 'short', 'hachimaki'), legs: '#f2c9a0' }),
    talk: [
      'Bales, boxes, barrels. If it’s heavy, I’ve carried it. Including a cow, once. Long story.',
      'They pay by the load. I’m paid by the bruise.',
      'My brother marched to Iga with the Oda last autumn. He came back quiet. Doesn’t talk now. Just carries.',
    ],
  },
  {
    title: 'sailor of the Ise Maru',
    names: ['A sailor', 'A deckhand', 'A sailor on shore leave'],
    homes: ['door:inn', 'door:tavern'],
    haunts: ['harbour', 'harbour', 'town'],
    look: (r) => ({ ...commoner(r, 'short', 'hachimaki'), robe: '#2f4a6a', robeShade: '#223650', legs: '#f2c9a0' }),
    talk: [
      'Three weeks at sea, three days in port. Guess which one is more dangerous. It’s the tavern.',
      'The captain talks to the ship. The ship doesn’t answer. I trust the ship more.',
      'Sea turtles bring good luck. You’re a little small for a sea turtle. Bring a little luck.',
    ],
  },
  {
    title: 'old townsman',
    names: ['An old man', 'A retired cooper', 'A grandfather'],
    homes: ['door:nagayaA', 'door:nagayaB', 'door:nagayaD'],
    haunts: ['town', 'temple'],
    look: (r) => ({ ...commoner(r, 'grayBun'), extras: ['beard'] }),
    talk: [
      'In my day the moat was full of eels. Now it’s full of ducks. Progress.',
      'I walk to the temple every day to remind the Buddha I’m still here.',
      'I’ve seen four lords take that castle. Every one said he’d be the last. Two of them were right, in a way.',
    ],
  },
  {
    title: 'town child',
    names: ['A child', 'A small boy', 'A small girl'],
    homes: ['door:nagayaA', 'door:nagayaB', 'door:nagayaC', 'door:nagayaD'],
    haunts: ['town', 'harbour'],
    look: (r) => ({ ...commoner(r, pick(r, ['kidBoy', 'kidGirl'] as Hair[])), kid: true, legs: '#f2c9a0' }),
    talk: ['Are you a kappa? Kappas live in the moat and pull your soul out through your bottom. Mum said. Are you a kappa?', 'Hachi says you’re a ninja turtle. That’s silly. Ninjas aren’t turtles. …Are they?'],
  },
  {
    title: 'refugee from Iga',
    names: ['A refugee', 'A thin woman', 'A man from Iga'],
    homes: ['door:tentA', 'door:tentB', 'door:tentC'],
    haunts: ['camp', 'camp', 'farm'],
    look: (r) => ({ ...commoner(r, pick(r, ['short', 'bun', 'grayBun'] as Hair[]), pick(r, [undefined, 'tenugui'] as (Hat | undefined)[])), robe: '#5e574a', robeShade: '#463f36', sash: '#2a2420', legs: '#463f36' }),
    talk: [
      'We walked here from Iga. Nine days. We had a cart. Then we had a cart’s worth of things on our backs. Then we didn’t.',
      'The farmers let us glean the paddy edges. Gonbei’s wife leaves a little extra. She thinks we don’t notice.',
      'Don’t look at me like that, turtle. You carry your house on your back. I envy you.',
    ],
  },
  {
    title: 'Oda foot soldier',
    names: ['A foot soldier', 'An ashigaru', 'A bored spearman'],
    homes: ['door:castle'],
    haunts: ['town', 'harbour', 'camp'],
    look: (r) => ({ ...commoner(r, 'short', 'jingasa', ['armor']), robe: '#3a3a42', robeShade: '#2a2a30' }),
    talk: [
      'Move along, turtle. Orders.',
      'Lord Nobunaga’s peace is upon the land. That’s why I carry a spear.',
      'We’re to look out for Iga men. Problem is, they look like everyone. So we just look at everyone.',
      'A kappa in the moat? If it’s not on my list, it’s not my problem.',
    ],
  },
  {
    title: 'wandering monk',
    names: ['A wandering monk', 'A begging monk'],
    homes: ['door:kuri'],
    haunts: ['temple', 'town'],
    look: () => ({ hair: 'bald', hat: 'kasa', robe: '#2a2233', robeShade: '#1a1622', sash: '#c9a040', legs: '#2a2233', collar: '#e8e0cc', extras: ['kesa'] }),
    talk: ['I walk from temple to temple. Every road is the right road. Some are just longer.', 'Alms? …You are a turtle. Never mind. Bless you, turtle.'],
  },
]

const NO_SHELL = ['Huh. A rock with a scarf.', 'Is that a rock? …Is that rock looking at me?', 'Nice rock.', 'KAPPA! …No. A rock. Sorry, rock.']
const TURTLE = ['A turtle! In town!', 'Oh! Mind the turtle!', 'Look, a turtle! Lucky!', 'Is that… a turtle in a scarf?', 'Is that a kappa? Keep it away from the moat!']

export function makeExtras(count = 33): VillagerSpec[] {
  const r = rng(1600)
  const out: VillagerSpec[] = []
  for (let i = 0; i < count; i++) {
    const role = ROLES[i % ROLES.length]
    const look = role.look(r)
    const route: string[] = []
    for (let k = 0; k < 6; k++) route.push(pick(r, SPOTS[pick(r, role.haunts)]))
    const route2: string[] = []
    for (let k = 0; k < 6; k++) route2.push(pick(r, SPOTS[pick(r, role.haunts)]))
    const wake = 6 + Math.floor(r() * 3)
    const lunch = 11 + Math.floor(r() * 2)
    const back = 17 + Math.floor(r() * 2)
    const min = () => String(Math.floor(r() * 6) * 10).padStart(2, '0')
    const homeAt = pick(r, role.homes)
    out.push({
      id: `extra${i}`,
      name: pick(r, role.names),
      title: role.title,
      home: homeAt,
      look,
      color: '#8a8070',
      speed: look.kid ? 38 : 26 + Math.floor(r() * 8),
      schedule: [
        asleep(),
        { at: `0${wake}:${min()}`, label: 'out and about', doing: patrol(route, undefined, 'stand', 4 + Math.floor(r() * 8)) },
        home(`${lunch}:${min()}`, 'lunch'),
        { at: `${lunch + 1}:${min()}`, label: 'out and about', doing: patrol(route2, undefined, 'stand', 4 + Math.floor(r() * 8)) },
        home(`${back}:${min()}`),
        asleep(`2${Math.floor(r() * 3)}:00`),
      ],
      talk: role.talk,
      turtle: TURTLE,
      shell: NO_SHELL,
      barks: {},
      extra: true,
    })
  }
  return out
}
