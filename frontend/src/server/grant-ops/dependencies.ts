/**
 * Dependency Composition Boundary
 *
 * This module provides explicit dependency injection for the grant-ops backend.
 * All services and routes should be composed through this boundary rather than
 * directly importing repository globals or creating adapters inline.
 */

import { getDataDir, loadBackupFreshness, resetPersistentStateForTests } from '../../../../shared/grant-ops-persistence';
import type { BackupFreshnessStatus, OpencodeSettings } from '../../../../shared/types';
import { exportBackupSnapshot, importBackupSnapshot, recordBackupVerification } from './backup-service';
import type { BackupSnapshot } from './backup-service';
import { createOpencodeAdapter } from './opencode-client';
import type { OpencodeAdapter } from './opencode-client';
import * as repository from './repository';
import * as sourceService from './source-service';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generateId(prefix: string): string;
}

export interface PersistenceRoot {
  getBaseDir(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export const cryptoIdGenerator: IdGenerator = {
  generateId: (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
};

export const cwdPersistenceRoot: PersistenceRoot = {
  getBaseDir: () => getDataDir(),
};

export interface Dependencies {
  repository: typeof repository;
  sourceService: typeof sourceService;
  createOpencodeAdapter(settings: OpencodeSettings, providerType?: 'cli' | 'fake'): OpencodeAdapter;
  clock: Clock;
  idGenerator: IdGenerator;
  persistenceRoot: PersistenceRoot;
  backup: {
    exportBackupSnapshot(): Promise<BackupSnapshot>;
    importBackupSnapshot(snapshot: BackupSnapshot): Promise<void>;
    recordBackupVerification(snapshot: BackupSnapshot): Promise<void>;
  };
  loadBackupFreshness(): Promise<BackupFreshnessStatus>;
  resetPersistentStateForTests(): Promise<void>;
}

export function createDependencies(
  overrides: Partial<{
    repository: typeof repository;
    sourceService: typeof sourceService;
    createOpencodeAdapter(settings: OpencodeSettings, providerType?: 'cli' | 'fake'): OpencodeAdapter;
    clock: Clock;
    idGenerator: IdGenerator;
    persistenceRoot: PersistenceRoot;
    backup: Dependencies['backup'];
    loadBackupFreshness: Dependencies['loadBackupFreshness'];
    resetPersistentStateForTests: Dependencies['resetPersistentStateForTests'];
  }> = {},
): Dependencies {
  return {
    repository,
    sourceService,
    createOpencodeAdapter:
      overrides.createOpencodeAdapter ?? createOpencodeAdapter,
    clock: overrides.clock ?? systemClock,
    idGenerator: overrides.idGenerator ?? cryptoIdGenerator,
    persistenceRoot: overrides.persistenceRoot ?? cwdPersistenceRoot,
    backup: overrides.backup ?? {
      exportBackupSnapshot,
      importBackupSnapshot,
      recordBackupVerification,
    },
    loadBackupFreshness: overrides.loadBackupFreshness ?? loadBackupFreshness,
    resetPersistentStateForTests: overrides.resetPersistentStateForTests ?? resetPersistentStateForTests,
  };
}

let globalDependencies: Dependencies | null = null;

export function getDependencies(): Dependencies {
  if (!globalDependencies) {
    globalDependencies = createDependencies();
  }
  return globalDependencies;
}

export function setDependencies(deps: Dependencies): void {
  globalDependencies = deps;
}

export function resetDependencies(): void {
  globalDependencies = null;
}
