/**
 * Lightweight logger utility.
 *
 * In development it writes to the console. In production this can be
 * swapped out for a real service (e.g. Sentry, Datadog) without
 * touching call‑sites.
 */

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, context?: unknown) {
  // TODO: replace with a real logging service in production
  const timestamp = new Date().toISOString();
  const payload = { timestamp, level, message, ...(context !== undefined && { context }) };

  switch (level) {
    case 'info':
      console.info(JSON.stringify(payload));
      break;
    case 'warn':
      console.warn(JSON.stringify(payload));
      break;
    case 'error':
      console.error(JSON.stringify(payload));
      break;
  }
}

export const logger = {
  info: (message: string, context?: unknown) => log('info', message, context),
  warn: (message: string, context?: unknown) => log('warn', message, context),
  error: (message: string, context?: unknown) => log('error', message, context),
};
