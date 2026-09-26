// Master Roshi's voice: chiptune blips that murmur a line of text, one short note per syllable.
// No words, just the shape of speech — each vowel picks a note of the in scale, punctuation the pauses
// and the melody's fall, rise or jump at the end of a sentence.

import { getGraph, isRunning } from "./engine";
import { scaleHz } from "./instruments";

export interface Murmur {
  /** Seconds from now until the last syllable ends. */
  duration: number;
  /** Cuts the line off (panel changed, scroll closed). */
  stop(): void;
}

const PACE = 0.15; // seconds per syllable: the reading-speed knob
const BLIP = 0.07; // how long each note sounds within its syllable
const WORD_GAP = 0.05;
const COMMA_GAP = 0.25;
const STOP_GAP = 0.45;
const VOLUME = 0.12;

/** Scale degree per vowel (in scale on D, see instruments.ts); degree 5 is D4. */
const VOWEL_DEGREE: Record<string, number> = { a: 7, e: 8, i: 9, o: 6, u: 5 };
const VOWELS = "aeiou";

interface Syllable {
  vowel: string;
  laugh: boolean; // part of a "hohoho"
  end?: "." | "?" | "!"; // last syllable of a sentence
}
type Token = Syllable | { gap: number };

function tokenize(text: string): Token[] {
  const plain = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const out: Token[] = [];
  for (const m of plain.matchAll(/[a-z0-9'’-]+|[,;:]|[.!?…]+/g)) {
    const w = m[0];
    if (/^[,;:]$/.test(w)) {
      out.push({ gap: COMMA_GAP });
      continue;
    }
    if (/^[.!?…]/.test(w)) {
      // Mark the sentence's last syllable so the melody can fall, rise or jump there.
      for (let i = out.length - 1; i >= 0; i--) {
        const t = out[i];
        if ("vowel" in t) {
          t.end = w.includes("?") ? "?" : w.includes("!") ? "!" : ".";
          break;
        }
      }
      out.push({ gap: STOP_GAP });
      continue;
    }
    const laugh = /^(ho){2,}$/.test(w);
    const runs = [...w.matchAll(/[aeiouy]+/g)];
    if (runs.length) {
      for (const r of runs) out.push({ vowel: r[0][0] === "y" ? "i" : r[0][0], laugh });
    } else {
      // Numbers and vowel-less words: about one syllable per two characters ("1582" → 2).
      for (let i = 0; i < Math.max(1, Math.round(w.length / 2)); i++)
        out.push({ vowel: VOWELS[(w.charCodeAt(i) + i) % 5], laugh: false });
    }
    out.push({ gap: WORD_GAP });
  }
  return out;
}

/** Murmurs `text` now. Null when audio is unavailable or still locked (no user gesture yet). */
export function murmur(text: string): Murmur | null {
  const g = getGraph();
  if (!g || !isRunning()) return null;
  const { ctx } = g;
  const start = ctx.currentTime + 0.05;

  // Square wave, softened a little so it chirps rather than buzzes.
  const out = ctx.createGain();
  out.gain.value = VOLUME;
  const soft = ctx.createBiquadFilter();
  soft.type = "lowpass";
  soft.frequency.value = 3500;
  soft.connect(out);
  out.connect(g.sfx);
  const send = ctx.createGain();
  send.gain.value = 0.15;
  out.connect(send).connect(g.reverb);

  const note = (degree: number, t: number, len: number, bend = 0) => {
    const hz = scaleHz(degree);
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(hz, t);
    if (bend) osc.frequency.linearRampToValueAtTime(hz * Math.pow(2, bend / 12), t + len);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.005);
    env.gain.setValueAtTime(1, t + len - 0.015);
    env.gain.linearRampToValueAtTime(0, t + len);
    osc.connect(env).connect(soft);
    osc.start(t);
    osc.stop(t + len + 0.01);
  };

  let t = start;
  let k = 0; // syllable index within the sentence
  let laughN = 0;
  for (const tok of tokenize(text)) {
    if ("gap" in tok) {
      t += tok.gap;
      if (tok.gap === STOP_GAP) k = 0;
      continue;
    }
    let len = PACE * (0.9 + Math.random() * 0.2);
    if (tok.laugh) {
      // Hohoho: quick, high, stepping down.
      note(12 - laughN++, t, 0.06);
      t += 0.1;
      k++;
      continue;
    }
    laughN = 0;
    // The melody drifts down a step every few syllables, with a little wobble.
    let degree = VOWEL_DEGREE[tok.vowel] - Math.min(3, Math.floor(k / 6)) + (Math.random() < 0.25 ? 1 : 0);
    let bend = 0;
    if (tok.end === ".") degree -= 2;
    if (tok.end === "?") bend = 4;
    if (tok.end === "!") degree += 2;
    if (tok.end) len *= 1.4; // the last syllable of a sentence drags
    note(degree, t, tok.end ? BLIP * 1.8 : BLIP, bend);
    t += len;
    k++;
  }

  let stopped = false;
  return {
    duration: t - ctx.currentTime,
    stop() {
      if (stopped) return;
      stopped = true;
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
      setTimeout(() => out.disconnect(), 200);
    },
  };
}
