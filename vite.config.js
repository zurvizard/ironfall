import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env.PAGES_BASE_PATH || '/ironfall/') : '/',
}))
