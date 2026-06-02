import { describe, it, expect } from 'vitest';
import { logger, getSessionLogPath } from '@/lib/logger';

describe('logger', () => {
  describe('exports', () => {
    it('exports the logger as a pino instance with callable log-level methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.fatal).toBe('function');
      expect(typeof logger.trace).toBe('function');
    });

    it('exports getSessionLogPath as a function', () => {
      expect(typeof getSessionLogPath).toBe('function');
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
