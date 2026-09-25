import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import { resolve, normalize, join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const GAMES_DIR = resolve(__dirname, '../games')

// Serves ../games at /games in dev and copies it into dist/games on build,
// so the app reads the backend's output directly with no API server.
function gamesDir(): Plugin {
  return {
    name: 'chezz-games',
    configureServer(server) {
      server.middlewares.use('/games', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '/').split('?')[0])
        const file = normalize(join(GAMES_DIR, rel))
        if (!file.startsWith(GAMES_DIR) || !existsSync(file) || !statSync(file).isFile()) return next()
        const type = file.endsWith('.json') ? 'application/json' : file.endsWith('.md') ? 'text/markdown' : 'text/plain'
        res.setHeader('Content-Type', `${type}; charset=utf-8`)
        res.setHeader('Cache-Control', 'no-store')
        createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      if (existsSync(GAMES_DIR)) cpSync(GAMES_DIR, resolve(__dirname, 'dist/games'), { recursive: true })
    },
  }
}

export default defineConfig({
  plugins: [react(), gamesDir()],
  server: { fs: { allow: ['..'] } },
})
