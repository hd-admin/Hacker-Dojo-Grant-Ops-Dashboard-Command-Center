/**
 * Dependency Composition Boundary
 *
 * This module provides explicit dependency injection for the grant-ops backend.
 * All services and routes should be composed through this boundary rather than
 * directly importing repository globals or creating adapters inline.
 *
 * This enables:
 * - Clean unit testing with injected mocks
 * - Deterministic behavior under test
 * - No hidden module globals or singletons
 *
 * Production composition: createDependencies() with real implementations
 * Test composition: createDependencies() with mock/fake implementations
 */

import type { OpencodeSettings } from '../../../../shared/types';
import type { OpencodeAdapter } from './opencode-client';
import { createOpencodeAdapter } from './opencode-client';
import * as repository from './repository';
import * as sourceService from './source-service';

// Type definitions for injectable dependencies
export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generateId(prefix: string): string;
}

export interface PersistenceRoot {
  getBaseDir(): string;
}

// Default implementations
export const systemClock: Clock = {
  now: () => new Date(),
};

export const cryptoIdGenerator: IdGenerator = {
  generateId: (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
};

export const cwdPersistenceRoot: PersistenceRoot = {
  getBaseDir: () => process.cwd(),
};

// Dependency container interface
export interface Dependencies {
  // Repository access
  repository: typeof repository;

  // Source service access
  sourceService: typeof sourceService;

  // Opencode adapter factory
  createOpencodeAdapter(settings: OpencodeSettings, providerType?: 'cli' | 'fake'): OpencodeAdapter;

  // Clock for time-dependent operations
  clock: Clock;

  // ID generator for creating unique IDs
  idGenerator: IdGenerator;

  // Persistence root resolver
  persistenceRoot: PersistenceRoot;
}

// Production dependency container
export function createDependencies(
  overrides: Partial<{
    repository: typeof repository;
    sourceService: typeof sourceService;
    createOpencodeAdapter(settings: OpencodeSettings, providerType?: 'cli' | 'fake'): OpencodeAdapter;
    clock: Clock;
    idGenerator: IdGenerator;
    persistenceRoot: PersistenceRoot;
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
  };
}

// Global dependency container for production use
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
