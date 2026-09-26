# 02 — Cast

Both sides use the **same six roles**, one per piece type. The role sets how a piece **talks** (this doc and `lines.json`) and how it **moves and reacts** ([04](04-animation-reactions.md)).

| Role id | Piece | Armor | Tokugawa (our engine) | Akechi (Stockfish) |
|---|---|---|---|---|
| `lord` | King | heaviest | Tokugawa Ieyasu | Akechi Mitsuhide |
| `commander` | Queen | heavy* | Hattori Hanzō | Akechi Hidemitsu |
| `ninja` | Knight | none | Iga ninja | Kōka scouts |
| `monk` | Bishop | light | Yamabushi (mountain ascetics) | Warrior monks (sōhei) |
| `garrison` | Rook | heavy | Tokugawa castle garrison | Akechi garrison |
| `ashigaru` | Pawn | light | Ashigaru foot soldiers | Samurai hunters (*ochimusha-gari*) |

The rook is a castle keep (tenshu) with its garrison of samurai and archers. Their lines are about walls, gates, arrows and honor. Since the knights ride horses, no rook line mentions horses.

\* Hanzō wears heavy armor but **moves like a ninja** (vanishes and reappears). This makes him the ninja commander, not just an armored piece. Hidemitsu moves like a heavy general.

**Side mapping.** `GameRecord.ourColor` = Tokugawa, and the other color = Akechi. For a bare FEN with no record, White = Tokugawa.

The ids, armor classes and display names are defined in [`types.ts`](../../frontend/src/story/types.ts) (`ROLE_BY_PIECE`, `ARMOR`, `DISPLAY_NAME`). If anything here disagrees with the code, the code wins; fix this doc.

## General voice rules (both sides)

- **Tokugawa** are the hunted: patient, loyal, understated, sometimes scared, with dry humor. They talk about *home, the road, the night, patience*.
- **Akechi** are the hunters: arrogant, predatory, impatient, and cracking under pressure. They talk about *the hunt, the net, the bounty, the realm*.
- Maximum 60 characters per line. One or two short sentences.
- No modern slang, no pop-culture references, and no direct chess words except "check" (said only by ashigaru, clumsily).

---

## Tokugawa side

### Tokugawa Ieyasu — `lord` (King)
- **Personality:** a patient survivor. He has lost battles before and learned from them. Calm under pressure, but human; he calls for Hanzō when afraid.
- **Voice:** slow and measured, uses proverbs about patience and burdens. Never boasts and never panics in full sentences.
- **Signature lines:** "Patience. I have outlived worse." / "Paint my face as it is now." / "Life is a long road with a heavy load."
- **Look:** older lord in heavy lacquered armor with a golden fan and a *hollyhock* crest (three leaves in a circle). Always flanked visually by a banner.

### Hattori Hanzō — `commander` (Queen)
- **Personality:** cold, efficient, loyal to the bone. The most dangerous piece on the board, and he knows it.
- **Voice:** the fewest words of anyone, often three or fewer. Sometimes only "...". Never explains himself and never raises his voice.
- **Signature lines:** "Silence is the sharpest blade." / "You never heard me." / "Two throats. One blade."
- **Look:** the Demon: a black horned oni helmet, a black mask with glowing gold eyes and white fangs, and a long spear (Hanzō was famous for his spear). Sprite `q`, drawn to look nothing like the gold-crested king. He vanishes in smoke when he moves.

### Iga ninja — `ninja` (Knight)
- **Personality:** playful, cocky, fast. They enjoy this too much.
- **Voice:** short, teasing, with sly jokes. Mock the enemy, especially the rival Kōka ninja.
- **Signature lines:** "Two birds. One stone. Zero witnesses." / "Where am I? Exactly."
- **Look:** rides a brown horse, like the chess knight. Unarmored, with a flying gold headband, a katana raised high, and a clan-colored saddle cloth (sprite `n` in `frontend/src/pixel/sprites.ts`). In the intro's oath panel they appear on foot, hiding in the trees.

### Yamabushi — `monk` (Bishop)
- **Personality:** serene mountain ascetics who fight when they must. They find everything slightly funny in a cosmic way.
- **Voice:** proverbs and nature images (mountains, rivers, blossoms). Calm, even when dying.
- **Signature lines:** "The straight road is for fools." / "The mountain does not move. Nor do I."
- **Look:** white and ochre robes, a small black *tokin* cap, a conch-shell horn, a staff.

### Tokugawa garrison — `garrison` (Rook)
- **Personality:** the samurai and archers holding a castle keep. Proud, loud, honorable, and eager to sally out. They hate retreating.
- **Voice:** exclamations about walls, gates, arrows, "honor" and "glory", and challenges shouted at the enemy.
- **Signature lines:** "Face me, coward!" / "To your side, my lord!" / "The wall is raised! None shall pass!"
- **Look:** a tenshu castle keep in ivory lacquer with indigo roofs (sprite `r`).

### Ashigaru — `ashigaru` (Pawn)
- **Personality:** frightened common soldiers who secretly dream of becoming samurai. The comic heart of the cast.
- **Voice:** nervous, informal, mentions mother, rice and the village. Very excited by small victories.
- **Signature lines:** "Nobody told me about this part." / "Mother... I'm going to be a samurai!"
- **Look:** simple conical *jingasa* hat, light armor, a spear taller than the soldier.

---

## Akechi side

### Akechi Mitsuhide — `lord` (King)
- **Personality:** a cold, proud usurper who believes Heaven is on his side. His confidence cracks when threatened.
- **Voice:** formal and commanding. Under pressure, short angry outbursts. References his very short reign.
- **Signature lines:** "The enemy is at Honnō-ji. And now, in Iga." / "Three days. My reign lasted three days."
- **Look:** dark armor with a *bellflower* (kikyō) crest in blue and a war fan. Red-lit from below.

### Akechi Hidemitsu — `commander` (Queen)
- **Personality:** Mitsuhide's loyal and ruthless general. A professional hunter.
- **Voice:** clipped and sarcastic. Treats the Tokugawa as prey.
- **Signature lines:** "Found you, old fox." / "Next." / "Careless. Iga has grown soft."
- **Look:** the same horned oni sprite in Akechi red, with a spear.

### Kōka scouts — `ninja` (Knight)
- **Personality:** rival ninja from the neighboring province, contemptuous of Iga.
- **Voice:** sly and superior, mocking Iga as "predictable" and "tired".
- **Signature lines:** "Iga is so predictable." / "Kōka sees everything."
- **Look:** the same mounted-ninja sprite in Akechi red.

### Warrior monks — `monk` (Bishop)
- **Personality:** zealous and grim. They remember Nobunaga burning Mount Hiei (1571) and are glad he is dead.
- **Voice:** sermons, karma, judgment. Darker mirror images of the yamabushi proverbs.
- **Signature lines:** "Your karma found you." / "Mount Hiei... is avenged..."
- **Look:** dark hooded robes (*sōhei* style) and a *naginata*.

### Akechi garrison — `garrison` (Rook)
- **Personality:** brutal, loud and impatient. They love crushing anyone who comes near their walls.
- **Voice:** battle cries and insults ("Tokugawa dog", "old fox"), gates and arrows.
- **Signature lines:** "Run, old fox! Run!" / "Crushed beneath the walls!" / "Loose the arrows!"
- **Look:** a tenshu castle keep in crimson lacquer with charcoal roofs (sprite `r`).

### Samurai hunters — `ashigaru` (Pawn)
- **Personality:** greedy local peasants hunting fleeing samurai for the bounty. Not evil, just poor and opportunistic.
- **Voice:** everything is about the reward, the loot and the rice. Cowardly when things go wrong.
- **Signature lines:** "There's gold for a runaway lord's head." / "Who's a peasant now?!"
- **Look:** ragged clothes, bamboo spears, torches.

---

## Display names (for `{target}`, `{lord}`, `{enemyLord}`)

| Role | Tokugawa | Akechi |
|---|---|---|
| lord | Lord Ieyasu | Lord Mitsuhide |
| commander | Hanzō | Hidemitsu |
| ninja | Iga ninja | Kōka scout |
| monk | yamabushi | warrior monk |
| garrison | castle garrison | Akechi garrison |
| ashigaru | ashigaru | hunter |

`{target}` always uses the **target's own side** for its name. When Hanzō takes an Akechi rook, `{target}` = "Akechi garrison".
