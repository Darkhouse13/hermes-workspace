import { execSync, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import * as net from 'node:net'
import { resolve, dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

export const processState = {
  // Hermes Agent
  hermesAgentChild: null as ChildProcess | null,
  hermesAgentStarted: false,

  // Workspace Daemon
  workspaceDaemonStarted: false,
  workspaceDaemonStarting: false,
  workspaceDaemonShuttingDown: false,
  workspaceDaemonRestarting: false,
  workspaceDaemonChild: null as ChildProcess | null,
  workspaceDaemonRetryCount: 0,
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/** Resolve the hermes-agent directory using a priority-ordered fallback chain:
 *  1. HERMES_AGENT_PATH env var (explicit override)
 *  2. ../hermes-agent  — sibling clone (standard README setup)
 *  3. ../../hermes-agent — one level up (monorepo / nested workspace)
 *  Returns null if none found.
 */
export function resolveHermesAgentDir(
  env: Record<string, string>,
): string | null {
  const candidates: string[] = []

  if (env.HERMES_AGENT_PATH.trim()) {
    candidates.push(env.HERMES_AGENT_PATH.trim())
  }

  // Resolve relative to the workspace root (parent of clawsuite/)
  const workspaceRoot = dirname(resolve('.')) // clawsuite/ → parent
  candidates.push(
    resolve(workspaceRoot, 'hermes-agent'), // sibling of clawsuite/
    resolve(workspaceRoot, '..', 'hermes-agent'), // one level up
  )

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'webapi'))) return candidate
  }
  return null
}

/** Resolve the Python executable to use for uvicorn.
 *  Prefers .venv/bin/python inside agentDir, falls back to system python3.
 */
export function resolveHermesPython(agentDir: string): string {
  const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
  if (existsSync(venvPython)) return venvPython
  // uv creates 'venv' not '.venv' sometimes
  const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
  if (existsSync(uvVenv)) return uvVenv
  return 'python3'
}

// ---------------------------------------------------------------------------
// Health checks & port utilities
// ---------------------------------------------------------------------------

/** Check if hermes-agent health endpoint is responding */
export async function isHermesAgentHealthy(port = 8642): Promise<boolean> {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    })
    return r.ok
  } catch {
    return false
  }
}

export const isPortInUse = (port: number) =>
  new Promise<boolean>((resolvePortCheck) => {
    const socket = net.createConnection({ port, host: '127.0.0.1' })
    socket.once('connect', () => {
      socket.destroy()
      resolvePortCheck(true)
    })
    socket.once('error', () => resolvePortCheck(false))
  })

export async function hasHealthyWorkspaceDaemon(
  port: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/workspace/version`,
      { signal: AbortSignal.timeout(2000) },
    )
    return response.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Hermes Agent lifecycle
// ---------------------------------------------------------------------------

export async function startHermesAgent(
  env: Record<string, string>,
  hermesApiUrl: string,
): Promise<void> {
  if (processState.hermesAgentStarted) return

  // Skip auto-start when HERMES_API_URL is explicitly set to a non-local endpoint
  const explicitUrl =
    env.HERMES_API_URL ||
    process.env.HERMES_API_URL ||
    hermesApiUrl ||
    ''
  if (
    explicitUrl &&
    explicitUrl !== 'http://127.0.0.1:8642' &&
    explicitUrl !== 'http://localhost:8642'
  ) {
    console.log(
      `[hermes-agent] Skipping auto-start — using external API: ${explicitUrl}`,
    )
    processState.hermesAgentStarted = true
    return
  }

  if (await isHermesAgentHealthy()) {
    console.log('[hermes-agent] Already running — reusing existing process')
    processState.hermesAgentStarted = true
    return
  }

  const agentDir = resolveHermesAgentDir(env)
  if (!agentDir) {
    console.warn(
      '[hermes-agent] Could not find hermes-agent directory.\n' +
        '  Set HERMES_AGENT_PATH in .env or clone hermes-agent as a sibling:\n' +
        '    git clone https://github.com/outsourc-e/hermes-agent.git ../hermes-agent',
    )
    return
  }

  const python = resolveHermesPython(agentDir)
  console.log(`[hermes-agent] Starting from ${agentDir} using ${python}`)

  const child = spawn(
    python,
    [
      '-m',
      'uvicorn',
      'webapi.app:app',
      '--host',
      '0.0.0.0',
      '--port',
      '8642',
    ],
    {
      cwd: agentDir,
      detached: false, // keep tied to vite process — stops when dev server stops
      stdio: 'pipe',
      env: {
        ...process.env,
        PATH: `${resolve(agentDir, '.venv', 'bin')}:${resolve(agentDir, 'venv', 'bin')}:${process.env.PATH || ''}`,
      },
    },
  )

  processState.hermesAgentChild = child
  processState.hermesAgentStarted = true

  child.stdout.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    if (line) console.log(`[hermes-agent] ${line}`)
  })
  child.stderr.on('data', (d: Buffer) => {
    const line = d.toString().trim()
    if (line) console.log(`[hermes-agent] ${line}`)
  })

  child.on('exit', (code) => {
    processState.hermesAgentChild = null
    processState.hermesAgentStarted = false
    if (code !== 0 && code !== null) {
      console.warn(`[hermes-agent] Exited with code ${code}`)
    }
  })

  // Wait for healthy
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    if (await isHermesAgentHealthy()) {
      console.log('[hermes-agent] ✓ Ready on http://127.0.0.1:8642')
      return
    }
  }
  console.warn(
    '[hermes-agent] Started but health check timed out — may still be loading',
  )
}

export function stopHermesAgent(): void {
  if (processState.hermesAgentChild) {
    console.log('[hermes-agent] Stopping...')
    processState.hermesAgentChild.kill('SIGTERM')
    processState.hermesAgentChild = null
    processState.hermesAgentStarted = false
  }
}

// ---------------------------------------------------------------------------
// Workspace Daemon lifecycle
// ---------------------------------------------------------------------------

const getWorkspaceDaemonDelayMs = (attempt: number) =>
  Math.min(1000 * 2 ** Math.max(attempt - 1, 0), 30000)

export function startWorkspaceDaemon(
  port: string,
  daemonCwd: string,
  daemonSrcEntry: string,
  daemonDistEntry: string,
  dbPath: string,
): void {
  if (processState.workspaceDaemonShuttingDown) return
  if (
    processState.workspaceDaemonStarted ||
    processState.workspaceDaemonStarting
  )
    return

  const spawnCommand = existsSync(daemonSrcEntry)
    ? {
        commandName: 'npx',
        args: ['tsx', 'watch', 'src/server.ts'],
        options: {
          cwd: daemonCwd,
          env: {
            ...process.env,
            PORT: port,
            DB_PATH: dbPath,
            ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
          },
          stdio: 'inherit' as const,
        },
      }
    : existsSync(daemonDistEntry)
      ? {
          commandName: 'node',
          args: ['dist/server.js'],
          options: {
            cwd: daemonCwd,
            env: {
              ...process.env,
              PORT: port,
              DB_PATH: dbPath,
              ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? '',
            },
            stdio: 'inherit' as const,
          },
        }
      : null

  if (!spawnCommand) {
    processState.workspaceDaemonStarting = false
    console.error('[workspace-daemon] no server entry found to spawn.')
    return
  }

  processState.workspaceDaemonStarted = true
  processState.workspaceDaemonStarting = false
  const child = spawn(
    spawnCommand.commandName,
    spawnCommand.args,
    spawnCommand.options,
  )
  processState.workspaceDaemonChild = child

  child.on('exit', (code) => {
    if (processState.workspaceDaemonChild === child) {
      processState.workspaceDaemonChild = null
    }

    if (
      processState.workspaceDaemonShuttingDown ||
      processState.workspaceDaemonRestarting
    ) {
      processState.workspaceDaemonStarted = false
      processState.workspaceDaemonStarting = false
      return
    }

    if (code === 0) {
      processState.workspaceDaemonStarted = false
      processState.workspaceDaemonStarting = false
      return
    }

    if (processState.workspaceDaemonRetryCount >= 20) {
      processState.workspaceDaemonStarted = false
      processState.workspaceDaemonStarting = false
      console.error(
        `[workspace-daemon] crashed with code ${code ?? 'unknown'}; max restart attempts reached.`,
      )
      return
    }

    processState.workspaceDaemonRetryCount += 1
    const delayMs = getWorkspaceDaemonDelayMs(
      processState.workspaceDaemonRetryCount,
    )
    console.error(
      `[workspace-daemon] crashed with code ${code ?? 'unknown'}; restarting in ${Math.round(
        delayMs / 1000,
      )}s (${processState.workspaceDaemonRetryCount}/20).`,
    )

    processState.workspaceDaemonStarting = true
    processState.workspaceDaemonStarted = false
    setTimeout(() => {
      startWorkspaceDaemon(port, daemonCwd, daemonSrcEntry, daemonDistEntry, dbPath)
    }, delayMs)
  })

  child.on('error', (error) => {
    console.error(`[workspace-daemon] failed to spawn: ${error.message}`)
  })
}

export async function stopWorkspaceDaemon(): Promise<void> {
  const child = processState.workspaceDaemonChild
  if (!child) {
    processState.workspaceDaemonStarted = false
    processState.workspaceDaemonStarting = false
    return
  }

  processState.workspaceDaemonRestarting = true

  await new Promise<void>((resolvePromise) => {
    const exitTimer = setTimeout(() => {
      if (!child.killed && child.pid) {
        try {
          process.kill(child.pid, 'SIGKILL')
        } catch {
          // ignore
        }
      }
    }, 5000)

    child.once('exit', () => {
      clearTimeout(exitTimer)
      resolvePromise()
    })

    if (child.pid) {
      try {
        process.kill(child.pid, 'SIGTERM')
      } catch {
        clearTimeout(exitTimer)
        resolvePromise()
      }
    } else {
      clearTimeout(exitTimer)
      resolvePromise()
    }
  })

  processState.workspaceDaemonStarted = false
  processState.workspaceDaemonStarting = false
  processState.workspaceDaemonRestarting = false
}

export async function restartWorkspaceDaemon(
  port: string,
  daemonCwd: string,
  daemonSrcEntry: string,
  daemonDistEntry: string,
  dbPath: string,
): Promise<void> {
  processState.workspaceDaemonRetryCount = 0
  await stopWorkspaceDaemon()
  processState.workspaceDaemonStarted = false
  processState.workspaceDaemonStarting = false
  startWorkspaceDaemon(port, daemonCwd, daemonSrcEntry, daemonDistEntry, dbPath)
}

export function shutdownWorkspaceDaemon(): void {
  processState.workspaceDaemonShuttingDown = true
  processState.workspaceDaemonStarted = false
  processState.workspaceDaemonStarting = false
  if (processState.workspaceDaemonChild) {
    processState.workspaceDaemonChild.kill()
    processState.workspaceDaemonChild = null
  }
}

export async function autoStartWorkspaceDaemon(
  port: string,
  daemonCwd: string,
  daemonSrcEntry: string,
  daemonDistEntry: string,
  dbPath: string,
): Promise<void> {
  if (
    processState.workspaceDaemonStarted ||
    processState.workspaceDaemonStarting
  )
    return

  processState.workspaceDaemonStarting = true

  const running = await isPortInUse(Number(port))

  if (running) {
    const healthy = await hasHealthyWorkspaceDaemon(port)
    if (healthy) {
      processState.workspaceDaemonStarting = false
      console.log('[workspace-daemon] Reusing existing daemon')
      return
    }

    try {
      execSync(
        `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`,
      )
    } catch {
      // ignore stale cleanup failures and continue with a fresh spawn
    }
  }

  startWorkspaceDaemon(port, daemonCwd, daemonSrcEntry, daemonDistEntry, dbPath)
}
