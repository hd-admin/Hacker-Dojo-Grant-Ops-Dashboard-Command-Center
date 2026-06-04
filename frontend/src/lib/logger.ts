import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';
import { Writable } from 'node:stream';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');
const TMP_DIR = path.join(process.cwd(), '.grant-ops-data', 'tmp');

/**
 * A writable stream proxy that buffers log writes until the pino-roll
 * rotating stream is ready.  Using dynamic import avoids the Next.js
 * bundling issues that occur with pino.transport() worker threads.
 *
 * SonicBoom (used by pino-roll) accepts only a single data argument to
 * write().  We swallow the encoding/callback Node.js Writable arguments
 * and forward just the chunk.
 */
class RotatingLogStream extends Writable {
  private target: { write(data: unknown): void } | null = null;
  private buffer: Array<unknown> = [];

  constructor() {
    super();
    this.init();
  }

  private async init() {
    try {
      // pino-roll has no TypeScript declarations; load dynamically to
      // avoid Next.js bundling issues with pino.transport() worker threads.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pinoRollModule: any = await import('pino-roll');
      const pinoRoll = pinoRollModule.default || pinoRollModule;

      // Remove stale symlinks (and regular files left by crashes) so pino-roll doesn't throw EEXIST
      const symlinkPath = path.join(LOG_DIR, 'current.log');
      try {
        const stat = fs.lstatSync(symlinkPath);
        if (stat.isSymbolicLink() || stat.isFile()) {
          fs.unlinkSync(symlinkPath);
        }
      } catch {
        // path doesn't exist, ignore
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream: any = await pinoRoll({
        file: path.join(LOG_DIR, 'app'),
        frequency: 'daily',
        mkdir: true,
        symlink: true,
        extension: '.log',
      });
      this.target = stream as { write(data: unknown): void };
      this.flush();
    } catch {
      // Fallback to stdout if rotation setup fails
      this.target = process.stdout;
      this.flush();
    }
  }

  private flush() {
    if (!this.target) return;
    for (const chunk of this.buffer) {
      this.target.write(chunk);
    }
    this.buffer = [];
  }

  _write(
    chunk: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    if (this.target) {
      this.target.write(chunk);
      callback();
    } else {
      this.buffer.push(chunk);
      // Prevent unbounded growth while waiting for rotation setup
      if (this.buffer.length > 1000) {
        this.buffer.shift();
      }
      callback();
    }
  }
}

const stream = new RotatingLogStream();

const baseLogger = pino(
  {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
  },
  stream,
);

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
