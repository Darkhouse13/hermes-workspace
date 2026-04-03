import { URL, fileURLToPath } from 'node:url'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// devtools removed
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// nitro plugin removed (tanstackStart handles server runtime)
import { defineConfig, loadEnv } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

import {
  processState,
  startHermesAgent,
  stopHermesAgent,
  restartWorkspaceDaemon,
  shutdownWorkspaceDaemon,
  autoStartWorkspaceDaemon,
} from './src/server/process-manager'

const config = defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const hermesApiUrl = env.HERMES_API_URL?.trim() || 'http://127.0.0.1:8642'

  // Workspace daemon paths
  const workspaceDaemonPort = '3099'
  const daemonCwd = resolve('workspace-daemon')
  const daemonSrcEntry = resolve('workspace-daemon/src/server.ts')
  const daemonDistEntry = resolve('workspace-daemon/dist/server.js')
  const workspaceDaemonDbPath = resolve(
    'workspace-daemon/.workspaces/workspace.db',
  )

  // Allow access from Tailscale, LAN, or custom domains via env var
  // e.g. HERMES_ALLOWED_HOSTS=my-server.tail1234.ts.net,192.168.1.50
  let proxyTarget = 'http://127.0.0.1:18789'

  try {
    const parsed = new URL(hermesApiUrl)
    parsed.protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:'
    parsed.pathname = ''
    proxyTarget = parsed.toString().replace(/\/$/, '')
  } catch {
    // fallback
  }

  return {
    define: {
      // Note: Do NOT set 'process.env': {} here — TanStack Start uses environment-based
      // builds where isSsrBuild is unreliable. Blanket process.env replacement breaks
      // server-side code in Docker (kills runtime env var access).
      // Client-side process.env is handled per-environment below.
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    ssr: {
      external: [
        'playwright',
        'playwright-core',
        'playwright-extra',
        'puppeteer-extra-plugin-stealth',
      ],
    },
    optimizeDeps: {
      exclude: [
        'playwright',
        'playwright-core',
        'playwright-extra',
        'puppeteer-extra-plugin-stealth',
      ],
    },
    server: {
      // Force IPv4 — 'localhost' resolves to ::1 (IPv6) on Windows, breaking connectivity
      host: '0.0.0.0',
      port: 3000,
      strictPort: false, // allow fallback if 3000 is taken, but log clearly
      allowedHosts: true,
      watch: {
        // Exclude generated route tree — TanStack Router's file watcher
        // detects its own output as a change → infinite regeneration loop
        ignored: ['**/routeTree.gen.ts'],
      },
      proxy: {
        // WebSocket proxy: clients connect to /ws-hermes on the Hermes Workspace
        // server (any IP/port), which internally forwards to the local server.
        // This means phone/LAN/Docker users never need to reach port 18789 directly.
        '/ws-hermes': {
          target: proxyTarget,
          changeOrigin: false,
          ws: true,
          rewrite: (path) => path.replace(/^\/ws-hermes/, ''),
        },
        // REST API proxy: API proxy for Hermes backend
        '/api/hermes-proxy': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/hermes-proxy/, ''),
        },
        '/hermes-ui': {
          target: proxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/hermes-ui/, ''),
          ws: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (_proxyRes) => {
              // Strip iframe-blocking headers so we can embed
              delete _proxyRes.headers['x-frame-options']
              delete _proxyRes.headers['content-security-policy']
            })
          },
        },
        '/workspace-api': {
          target: 'http://127.0.0.1:3099',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/workspace-api/, ''),
        },
      },
    },
    plugins: [
      // devtools(),
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
      {
        name: 'workspace-daemon',
        buildStart() {
          if (command !== 'serve') return
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const requestPath = req.url?.split('?')[0]
            if (req.method === 'GET' && requestPath === '/api/healthcheck') {
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
              return
            }

            // Portable-aware health check — returns ok if any chat backend is available
            if (req.method === 'GET' && requestPath === '/api/connection-status') {
              try {
                // Check if the configured backend has /v1/models (works for Ollama, OpenAI, etc.)
                const modelsRes = await fetch(`${hermesApiUrl}/v1/models`, {
                  signal: AbortSignal.timeout(3000),
                })
                if (modelsRes.ok) {
                  res.statusCode = 200
                  res.setHeader('content-type', 'application/json')
                  res.end(JSON.stringify({ ok: true, mode: 'portable', backend: hermesApiUrl }))
                  return
                }
                // Fall back to /health for full Hermes backends
                const healthRes = await fetch(`${hermesApiUrl}/health`, {
                  signal: AbortSignal.timeout(3000),
                })
                res.statusCode = healthRes.ok ? 200 : 502
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ ok: healthRes.ok, mode: 'enhanced', backend: hermesApiUrl }))
              } catch {
                res.statusCode = 502
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify({ ok: false, mode: 'disconnected', backend: hermesApiUrl }))
              }
              return
            }

            if (
              req.method !== 'POST' ||
              requestPath !== '/api/workspace/daemon/restart'
            ) {
              next()
              return
            }

            try {
              await restartWorkspaceDaemon(
                workspaceDaemonPort,
                daemonCwd,
                daemonSrcEntry,
                daemonDistEntry,
                workspaceDaemonDbPath,
              )
              res.statusCode = 200
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (error) {
              res.statusCode = 500
              res.setHeader('content-type', 'application/json')
              res.end(
                JSON.stringify({
                  error:
                    error instanceof Error ? error.message : 'Internal error',
                }),
              )
            }
          })

          server.httpServer?.on('close', () => {
            shutdownWorkspaceDaemon()
          })

          // Auto-start hermes-agent when dev server launches
          if (command === 'serve') {
            void startHermesAgent(env, hermesApiUrl)
          }

          // Shutdown hermes-agent when dev server stops
          server.httpServer?.on('close', () => {
            stopHermesAgent()
          })

          if (
            command !== 'serve' ||
            processState.workspaceDaemonStarted ||
            processState.workspaceDaemonStarting
          )
            return

          void autoStartWorkspaceDaemon(
            workspaceDaemonPort,
            daemonCwd,
            daemonSrcEntry,
            daemonDistEntry,
            workspaceDaemonDbPath,
          )
        },
      },
      // Client-only: replace process.env references in client bundles
      // Server bundles must keep real process.env for Docker runtime env vars
      {
        name: 'client-process-env',
        enforce: 'pre',
        transform(code, _id) {
          const envName = this.environment?.name
          if (envName !== 'client') return null
          if (!code.includes('process.env') && !code.includes('process.platform')) return null

          // Replace specific env vars first, then the generic fallback
          let result = code
          result = result.replace(/process\.env\.HERMES_API_URL/g, JSON.stringify(hermesApiUrl))
          result = result.replace(/process\.env\.HERMES_API_TOKEN/g, JSON.stringify(env.HERMES_API_TOKEN || ''))
          result = result.replace(/process\.env\.NODE_ENV/g, JSON.stringify(mode))
          result = result.replace(/process\.env/g, '{}')
          result = result.replace(/process\.platform/g, '"browser"')
          return result
        },
      },
      // Copy pty-helper.py into the server assets directory after build
      {
        name: 'copy-pty-helper',
        closeBundle() {
          const src = resolve('src/server/pty-helper.py')
          const destDir = resolve('dist/server/assets')
          const dest = resolve(destDir, 'pty-helper.py')
          if (existsSync(src)) {
            mkdirSync(destDir, { recursive: true })
            copyFileSync(src, dest)
          }
        },
      },
    ],
  }
})

export default config
