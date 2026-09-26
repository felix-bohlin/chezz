// One-shot sound effects keyed by the dialogue Situation, so the audio layer and the story
// layer react to the same detected events.

import type { Situation } from "../story/types";
import { getGraph, type Graph } from "./engine";
import { gong, koto, scaleHz, taiko, woodClick } from "./instruments";

type Cue = (g: Graph, t: number) => void;

const arp = (degrees: number[], gap: number, vol = 0.5): Cue => (g, t) =>
  degrees.forEach((d, i) => koto(g, g.sfx, scaleHz(d), t + i * gap, vol));

const CUES: Partial<Record<Situation, Cue>> = {
  game_start: (g, t) => {
    gong(g, g.sfx, t, 0.35, 70, 7);
    arp([5, 7, 8, 10], 0.35, 0.35)(g, t + 1.2);
  },
  victory: (g, t) => {
    taiko(g, g.sfx, t, 0.9);
    taiko(g, g.sfx, t + 0.25, 0.9);
    arp([5, 7, 8, 10, 12, 15], 0.12, 0.5)(g, t + 0.5);
    gong(g, g.sfx, t + 1.3, 0.45, 90, 8);
  },
  defeat: (g, t) => {
    arp([10, 8, 6, 5, 1], 0.35, 0.4)(g, t);
    gong(g, g.sfx, t + 1.8, 0.5, 55, 9);
  },
  draw: (g, t) => {
    koto(g, g.sfx, scaleHz(5), t, 0.4);
    koto(g, g.sfx, scaleHz(8), t + 0.5, 0.4);
    gong(g, g.sfx, t + 1, 0.25, 80, 5);
  },
  checkmate: (g, t) => {
    [0, 0.1, 0.2, 0.3, 0.45].forEach((d, i) => taiko(g, g.sfx, t + d, 0.6 + i * 0.08));
    gong(g, g.sfx, t + 0.5, 0.6, 65, 9);
  },
  check: (g, t) => {
    taiko(g, g.sfx, t, 0.8);
    taiko(g, g.sfx, t + 0.18, 0.9, 0.9);
    koto(g, g.sfx, scaleHz(5), t + 0.05, 0.45);
    koto(g, g.sfx, scaleHz(6), t + 0.05, 0.45); // D against Eb: a deliberate clash
  },
  promotion: arp([5, 7, 8, 10, 12], 0.08, 0.5),
  fork: (g, t) => {
    woodClick(g, g.sfx, t, 0.6);
    koto(g, g.sfx, scaleHz(10), t + 0.05, 0.45);
    koto(g, g.sfx, scaleHz(12), t + 0.05, 0.45);
  },
  capture_up: (g, t) => {
    woodClick(g, g.sfx, t, 0.7, 1400);
    taiko(g, g.sfx, t + 0.02, 0.9, 0.9);
    koto(g, g.sfx, scaleHz(0), t + 0.02, 0.5);
  },
  capture: (g, t) => {
    woodClick(g, g.sfx, t, 0.7, 1400);
    taiko(g, g.sfx, t + 0.02, 0.6, 1.1);
  },
  trade: (g, t) => {
    woodClick(g, g.sfx, t, 0.6, 1400);
    taiko(g, g.sfx, t + 0.02, 0.5, 1.2);
  },
  sacrifice: (g, t) => {
    woodClick(g, g.sfx, t, 0.6);
    arp([8, 7, 5], 0.1, 0.4)(g, t + 0.05);
  },
  brilliant: arp([10, 12, 13, 15, 17], 0.06, 0.4),
  blunder: arp([6, 5, 1], 0.22, 0.4),
  castle: (g, t) => {
    woodClick(g, g.sfx, t, 0.5);
    woodClick(g, g.sfx, t + 0.12, 0.5, 1600);
  },
  en_passant: (g, t) => {
    woodClick(g, g.sfx, t, 0.5);
    koto(g, g.sfx, scaleHz(9), t + 0.05, 0.35);
  },
  hanging: (g, t) => koto(g, g.sfx, scaleHz(1), t, 0.3),
  pinned: (g, t) => koto(g, g.sfx, scaleHz(1), t, 0.3),
  king_danger: (g, t) => taiko(g, g.sfx, t, 0.4, 0.8),
  pawn_near_promotion: (g, t) => koto(g, g.sfx, scaleHz(12), t, 0.3),
};

/** The sound of a piece landing on its square — play on every move. */
export function playMove(): void {
  const g = getGraph();
  if (g) woodClick(g, g.sfx, g.ctx.currentTime, 0.5);
}

/** Plays the cue for a situation. Situations without a cue (quiet, retreat, …) stay silent. */
export function playSituation(situation: Situation): void {
  const g = getGraph();
  const cue = CUES[situation];
  if (g && cue) cue(g, g.ctx.currentTime + 0.02);
}

/** Koto glissando — the "driiing" of the campaign map unrolling. Sweeps up the in scale, then rings. */
export function playMapOpen(): void {
  const g = getGraph();
  if (!g) return;
  const t = g.ctx.currentTime + 0.02;
  const sweep = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  // Each string is plucked a little sooner than the last, like a hand dragged across the bridge.
  let at = t;
  sweep.forEach((d, i) => {
    koto(g, g.sfx, scaleHz(d), at, 0.18 + i * 0.02);
    at += 0.045 * Math.pow(0.93, i);
  });
  koto(g, g.sfx, scaleHz(15), at + 0.04, 0.55);
  koto(g, g.sfx, scaleHz(10), at + 0.04, 0.35);
  gong(g, g.sfx, t, 0.18, 70, 5);
}

/** Two plucked strings as a province scroll is opened. */
export function playProvince(): void {
  const g = getGraph();
  if (!g) return;
  const t = g.ctx.currentTime + 0.02;
  woodClick(g, g.sfx, t, 0.35);
  koto(g, g.sfx, scaleHz(7), t + 0.03, 0.4);
  koto(g, g.sfx, scaleHz(10), t + 0.11, 0.35);
}

/** A short falling phrase as the map is rolled up again. */
export function playMapClose(): void {
  const g = getGraph();
  if (!g) return;
  const t = g.ctx.currentTime + 0.02;
  [10, 8, 7].forEach((d, i) => koto(g, g.sfx, scaleHz(d), t + i * 0.07, 0.25));
}
