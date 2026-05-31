import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  }
}

const transport = process.env.NODE_ENV !== 'production'
  ? { target: 'pino-pretty', options: { colorize: true } }
  : {
    targets: [
      {
        target: 'pino/file',
        options: { destination: path.join(LOG_DIR, 'app.log') },
        level: 'info',
      },
      {
        target: 'pino/file',
        options: { destination: path.join(LOG_DIR, 'error.log') },
        level: 'error',
      },
    ],
  };

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(transport ? { transport } : {}),
});

export function createSessionLogger(jobId: string): pino.Logger {
  ensureLogDir();
  const sessionLogPath = path.join(LOG_DIR, `session-${jobId}.log`);
  return pino({
    level: 'debug',
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: sessionLogPath },
        },
        {
          target: 'pino-pretty',
          options: { colorize: process.env.NODE_ENV !== 'production' },
        },
      ],
    },
  });
}

export function cleanupOldLogs(maxRetentionDays = 90): { deleted: number; errors: string[] } {
  const result = { deleted: 0, errors: [] as string[] };
  try {
    ensureLogDir();
    const entries = fs.readdirSync(LOG_DIR);
    const cutoff = Date.now() - maxRetentionDays * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.endsWith('.log')) continue;
      const fullPath = path.join(LOG_DIR, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
          result.deleted++;
        }
      } catch (err) {
        result.errors.push(`${entry}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    result.errors.push(`Failed to clean logs: ${err instanceof Error ? err.message : String(err)}`);
  }
  return result;
}

export function getSessionLogPath(jobId: string): string {
  return path.join(LOG_DIR, `session-${jobId}.log`);
}
