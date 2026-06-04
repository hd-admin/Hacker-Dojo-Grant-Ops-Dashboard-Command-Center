import { describe, it, expect, beforeAll } from 'vitest';
import { logger, getSessionLogPath } from '@/lib/logger';
import fs from 'node:fs';
import path from 'node:path';

const LOG_DIR = path.join(process.cwd(), '.grant-ops-data', 'logs');

describe('logger', () => {
  beforeAll(() => {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  });

  describe('exports', () => {
    it('exports the logger as a callable function with log-level methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.fatal).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('is callable as a function (plan Step 5 requirement)', () => {
      expect(() => logger('hello from callable logger')).not.toThrow();
      expect(() => logger({ key: 'value' }, 'with context')).not.toThrow();
      expect(() => logger({ key: 'value' })).not.toThrow();
    });

    it('exports getSessionLogPath as a function', () => {
      expect(typeof getSessionLogPath).toBe('function');
    });
  });

  describe('log rotation', () => {
    it('writes log entries that appear in the rotated log file', async () => {
      const testMessage = `rotation-test-${Date.now()}`;
      logger.info(testMessage);

      // Wait for transport to flush (pino-roll uses SonicBoom which flushes asynchronously)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // pino-roll creates numbered log files (e.g., app.1.log)
      const files = fs.readdirSync(LOG_DIR);
      const logFiles = files.filter(
        (f) => f.startsWith('app.') && f.endsWith('.log'),
      );
      expect(logFiles.length).toBeGreaterThan(0);

      // Search all log files for the test message
      let found = false;
      let allContent = '';
      for (const logFile of logFiles) {
        const content = fs.readFileSync(path.join(LOG_DIR, logFile), 'utf-8');
        allContent += content;
        if (content.includes(testMessage)) {
          found = true;
          break;
        }
      }

      expect(found, `Test message not found in any log file. Files: ${logFiles.join(', ')}. Content: ${allContent}`).toBe(true);
    });

    it('creates a symlink to the current log file when symlink option is enabled', async () => {
      // pino-roll creates current.log symlink; allow time for it
      await new Promise((resolve) => setTimeout(resolve, 500));

      const currentLogPath = path.join(LOG_DIR, 'current.log');
      expect(fs.existsSync(currentLogPath)).toBe(true);
    });
  });

  describe('log level methods', () => {
    it('has an info method that does not throw when called with a string message', () => {
      expect(() => logger.info('test info message')).not.toThrow();
    });

    it('has a warn method that does not throw when called with a string message', () => {
      expect(() => logger.warn('test warn message')).not.toThrow();
    });

    it('has an error method that does not throw when called with a string message', () => {
      expect(() => logger.error('test error message')).not.toThrow();
    });

    it('has a debug method that does not throw when called with a string message', () => {
      expect(() => logger.debug('test debug message')).not.toThrow();
    });

    it('has a fatal method that does not throw when called with a string message', () => {
      expect(() => logger.fatal('test fatal message')).not.toThrow();
    });

    it('has a trace method that does not throw when called with a string message', () => {
      expect(() => logger.trace('test trace message')).not.toThrow();
    });
  });

  describe('structured logging with context', () => {
    it('accepts an object with context as the first argument and does not throw', () => {
      expect(() => logger.info({ foo: 'bar', userId: 42 }, 'message with context')).not.toThrow();
    });

    it('accepts an object with nested context (mergedObject pattern)', () => {
      expect(() =>
        logger.info({ nested: { key: 'value' }, count: 5 }, 'nested context message'),
      ).not.toThrow();
    });

    it('accepts an Error object as first argument', () => {
      const err = new Error('something went wrong');
      expect(() => logger.error(err, 'error with Error object')).not.toThrow();
    });

    it('accepts an Error object as the only argument', () => {
      const err = new Error('standalone error');
      expect(() => logger.error(err)).not.toThrow();
    });

    it('accepts a plain object without a message string', () => {
      expect(() => logger.info({ event: 'user-action', data: 'click' })).not.toThrow();
    });
  });

  describe('getSessionLogPath', () => {
    it('returns a path containing the jobId', () => {
      const path = getSessionLogPath('job-abc-123');
      expect(path).toContain('job-abc-123');
      expect(path).toContain('session');
    });

    it('returns a path ending with .log', () => {
      const path = getSessionLogPath('test-job');
      expect(path.endsWith('.log')).toBe(true);
    });
  });
});
