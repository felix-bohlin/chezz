// Public audio API for the game.
//
// Typical wiring:
//   installUnlock();                  // once, at app start
//   gameAudio.start();                // when a game begins (after a user click)
//   gameAudio.onPly({ situation, phase, material, kingInDanger });  // after every move
//   gameAudio.end("victory");         // when the game ends

import type { MaterialState, Phase, Situation } from "../story/types";
import { playMove, playSituation } from "./sfx";
import { getTension, setTension, startMusic, stopMusic, type Tension } from "./music";

export { installUnlock, unlockAudio, getSettings, setSettings, type AudioSettings } from "./engine";
export { playMapClose, playMapOpen, playMove, playProvince, playSituation } from "./sfx";
export { startMusic, stopMusic, isMusicPlaying, setTension, type Tension } from "./music";
export interface PlyAudio {
  /** Highest-priority situation for this ply (same one the dialogue engine picked), if any. */
  situation?: Situation;
  phase: Phase;
  /** From the human player's side. */
  material: MaterialState;
  /** Either lord in check or under king_danger pressure. */
  kingInDanger: boolean;
}

function tensionFor(p: PlyAudio): Tension {
  if (p.kingInDanger || p.situation === "check") return 2;
  if (p.phase !== "opening" || p.material !== "even") return 1;
  return 0;
}

export const gameAudio = {
  start(): void {
    setTension(0);
    startMusic();
    playSituation("game_start");
  },

  onPly(p: PlyAudio): void {
    playMove();
    if (p.situation) playSituation(p.situation);
    // Ease down one level at a time so the score doesn't whiplash after a single calm move.
    const target = tensionFor(p);
    const current = getTension();
    setTension(target >= current ? target : ((current - 1) as Tension));
  },

  /** Jumped (scrub, step back, click a move): match the new position's tension, play no cues. */
  seek(p: PlyAudio): void {
    setTension(tensionFor(p));
  },

  end(result: "victory" | "defeat" | "draw"): void {
    stopMusic();
    playSituation(result);
  },
};
