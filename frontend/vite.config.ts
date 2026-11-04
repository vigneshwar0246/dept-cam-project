import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const https = env.VITE_HTTPS_CERT && env.VITE_HTTPS_KEY ? {
    cert: readFileSync(env.VITE_HTTPS_CERT),
    key: readFileSync(env.VITE_HTTPS_KEY),
  } : undefined
  return { plugins: [react()], server: { host: env.VITE_HOST || '127.0.0.1', https } }
})
