import pino from 'pino';
import path from 'node:path';

const TMP_DIR = path.join(process.cwd(), '.grant-ops-data', 'tmp');

// Use pino without transports to avoid worker thread bundling issues in Next.js
const baseLogger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Callable logger wrapper: the exported logger is callable as a function
// and exposes all standard pino log-level methods.
export const logger = Object.assign(
  (objOrMsg: unknown, message?: string): void => {
    if (typeof objOrMsg === 'string') {
      baseLogger.info(objOrMsg);
    } else if (message !== undefined) {
      baseLogger.info(objOrMsg as Record<string, unknown>, message);
    } else {
      baseLogger.info(objOrMsg as Record<string, unknown>);
    }
  },
  {
    info: baseLogger.info.bind(baseLogger),
    warn: baseLogger.warn.bind(baseLogger),
    error: baseLogger.error.bind(baseLogger),
    debug: baseLogger.debug.bind(baseLogger),
    fatal: baseLogger.fatal.bind(baseLogger),
    trace: baseLogger.trace.bind(baseLogger),
    child: baseLogger.child.bind(baseLogger),
  },
);

export function getSessionLogPath(jobId: string): string {
  return path.join(TMP_DIR, `session-${jobId}.log`);
}
