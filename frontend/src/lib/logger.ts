import pino from 'pino';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');
const TMP_DIR = path.join(process.cwd(), '.grant-ops-data', 'tmp');

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

export function getSessionLogPath(jobId: string): string {
  return path.join(TMP_DIR, `session-${jobId}.log`);
}
