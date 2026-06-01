import pino from 'pino';
import path from 'node:path';

const TMP_DIR = path.join(process.cwd(), '.grant-ops-data', 'tmp');

// Use pino without transports to avoid worker thread bundling issues in Next.js
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

export function getSessionLogPath(jobId: string): string {
  return path.join(TMP_DIR, `session-${jobId}.log`);
}
