import { installInput } from './engine/input'
import { Screen } from './engine/screen'
import { Game } from './game'
import { loadFonts } from './ui/draw'

const el = document.getElementById('game') as HTMLCanvasElement
const screen = new Screen(el)
installInput(el)
void loadFonts()
const game = new Game(screen)
// Handy from the devtools console: game.clock.minutes = 19 * 60, game.player.x = …
;(window as unknown as { game: Game }).game = game

let last = performance.now()
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  game.update(dt)
  game.render()
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
