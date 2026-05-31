import pino from 'pino';
import path from 'node:path';
import fs from 'node:fs';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');
const TMP_DIR = path.join(process.cwd(), '.grant-ops-data', 'tmp');

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  }
}

function ensureTmpDir(): void {
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true, mode: 0o700 });
  }
}

const transport = process.env.NODE_ENV !== 'production'
  ? { target: 'pino-pretty', options: { colorize: true } }
  : {
    targets: [
      {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'app'),
          frequency: 'daily',
          mkdir: true,
          size: '20m',
          limit: { count: 10 },
          extension: '.log',
          dateFormat: 'yyyy-MM-dd',
        },
        level: 'info',
      },
      {
        target: 'pino-roll',
        options: {
          file: path.join(LOG_DIR, 'error'),
          frequency: 'daily',
          mkdir: true,
          size: '20m',
          limit: { count: 10 },
          extension: '.log',
          dateFormat: 'yyyy-MM-dd',
        },
        level: 'error',
      },
    ],
  };

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  ...(transport ? { transport } : {}),
});

export function createSessionLogger(jobId: string): pino.Logger {
  ensureTmpDir();
  const sessionLogPath = path.join(TMP_DIR, `session-${jobId}.log`);
  return pino({
    level: 'debug',
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
    transport: {
      targets: [
        {
          target: 'pino/file',
          options: { destination: sessionLogPath },
        },
        ...(process.env.NODE_ENV !== 'production'
          ? [{
            target: 'pino-pretty' as const,
            options: { colorize: true },
          }]
          : []),
      ],
    },
  });
}

export function cleanupOldLogs(maxRetentionDays = 365): { deleted: number; errors: string[] } {
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
  return path.join(TMP_DIR, `session-${jobId}.log`);
}
