const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const
type LogLevel = keyof typeof LOG_LEVELS

function getConfiguredLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? '').toLowerCase()
  if (env in LOG_LEVELS) return env as LogLevel
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

interface LogEntry {
  level: LogLevel
  module: string
  message: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void
  info(message: string, metadata?: Record<string, unknown>): void
  warn(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
}

function emit(entry: LogEntry): void {
  const stream = entry.level === 'error' || entry.level === 'warn' ? process.stderr : process.stdout
  stream.write(JSON.stringify(entry) + '\n')
}

export function createLogger(module: string): Logger {
  function log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[getConfiguredLevel()]) return
    const entry: LogEntry = {
      level,
      module,
      message,
      timestamp: new Date().toISOString(),
    }
    if (metadata) entry.metadata = metadata
    emit(entry)
  }

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
  }
}
