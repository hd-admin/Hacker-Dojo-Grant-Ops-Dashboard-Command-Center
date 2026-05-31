/**
 * Dependencies Service Tests
 *
 * Tests the dependency injection factory module.
 */

import { describe, expect, it, vi } from 'vitest';
import { createDependencies, getDependencies, resetDependencies, setDependencies } from './dependencies';
import type { OpencodeSettings } from '../../../../shared/types';

describe('dependencies', () => {
  it('createDependencies returns all required DI instances with correct types', () => {
    const deps = createDependencies();

    expect(deps.repository).toBeDefined();
    expect(deps.sourceService).toBeDefined();
    expect(typeof deps.createOpencodeAdapter).toBe('function');
    expect(typeof deps.clock.now).toBe('function');
    expect(deps.clock.now()).toBeInstanceOf(Date);
    expect(typeof deps.idGenerator.generateId).toBe('function');
    expect(typeof deps.persistenceRoot.getBaseDir).toBe('function');
    expect(typeof deps.backup.exportBackupSnapshot).toBe('function');
    expect(typeof deps.backup.importBackupSnapshot).toBe('function');
    expect(typeof deps.backup.recordBackupVerification).toBe('function');
    expect(typeof deps.loadBackupFreshness).toBe('function');
    expect(typeof deps.resetPersistentStateForTests).toBe('function');
  });

  it('createDependencies allows overriding individual dependencies', () => {
    const mockClock = { now: () => new Date('2026-01-01T00:00:00Z') };
    const mockIdGen = { generateId: (prefix: string) => `${prefix}-mock-123` };

    const deps = createDependencies({
      clock: mockClock,
      idGenerator: mockIdGen,
    });

    expect(deps.clock.now()).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(deps.idGenerator.generateId('test')).toBe('test-mock-123');
  });

  it('createDependencies createOpencodeAdapter can be overridden', () => {
    const mockAdapter = { run: vi.fn() } as unknown as ReturnType<typeof deps.createOpencodeAdapter>;
    let deps = createDependencies();
    const mockCreateAdapter = vi.fn(() => mockAdapter);

    deps = createDependencies({
      createOpencodeAdapter: mockCreateAdapter as typeof deps.createOpencodeAdapter,
    });

    const settings: OpencodeSettings = {
      binaryPath: '/test',
      workingDirectory: '/tmp',
      timeoutMs: 1000,
      isConfigured: true,
    };
    const adapter = deps.createOpencodeAdapter(settings);
    expect(mockCreateAdapter).toHaveBeenCalledWith(settings);
    expect(adapter).toBe(mockAdapter);
  });

  it('getDependencies lazily initializes global dependencies', () => {
    resetDependencies();
    const deps = getDependencies();
    expect(deps).toBeDefined();
    expect(deps.repository).toBeDefined();
    expect(deps.clock).toBeDefined();
  });

  it('setDependencies updates global dependencies', () => {
    const mockClock = { now: () => new Date('2026-06-01T00:00:00Z') };
    const customDeps = createDependencies({ clock: mockClock });
    setDependencies(customDeps);

    const deps = getDependencies();
    expect(deps.clock.now()).toEqual(new Date('2026-06-01T00:00:00Z'));

    resetDependencies();
  });

  it('resetDependencies clears global dependencies so next getDependencies re-initializes', () => {
    resetDependencies();
    const deps1 = getDependencies();
    resetDependencies();
    const deps2 = getDependencies();
    expect(deps1).not.toBe(deps2);
    expect(deps2.repository).toBeDefined();
  });
});
