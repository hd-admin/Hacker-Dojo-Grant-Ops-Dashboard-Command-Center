import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  runPeerDiscovery,
  runFunderInsights,
  runEligibilityVetting,
} from './discovery-services';
import { createDependencies, setDependencies, resetDependencies } from './dependencies';

describe('discovery-services', () => {
  const mockClock = {
    now: () => new Date('2026-01-15T00:00:00Z'),
  };

  const mockIdGenerator = {
    generateId: (prefix: string) => `${prefix}-test-id`,
  };

  beforeEach(() => {
    setDependencies(
      createDependencies({
        clock: mockClock,
        idGenerator: mockIdGenerator,
      }),
    );
  });

  afterEach(() => {
    resetDependencies();
  });

  describe('runPeerDiscovery', () => {
    it('returns a peer discovery artifact', async () => {
      const result = await runPeerDiscovery('test query');

      expect(result.artifact.artifactType).toBe('peer-discovery');
      expect(result.artifact.jobId).toBe('peer-test-id');
      expect(result.artifact.timestamp).toBe('2026-01-15T00:00:00.000Z');
      expect(result.artifact.results).toHaveLength(1);
      expect(result.artifact.results[0]!.funderName).toBe('Mock Foundation');
      expect(result.artifact.organizationsAnalyzed).toBe(1);
    });
  });

  describe('runFunderInsights', () => {
    it('returns a funder insights artifact', async () => {
      const result = await runFunderInsights('funder-123');

      expect(result.artifact.artifactType).toBe('funder-insights');
      expect(result.artifact.jobId).toBe('fi-test-id');
      expect(result.artifact.funderId).toBe('funder-123');
      expect(result.artifact.patterns).toHaveLength(1);
      expect(result.artifact.patterns[0]!.patternType).toBe('giving-trend');
      expect(result.artifact.givingTrends).toHaveLength(1);
    });
  });

  describe('runEligibilityVetting', () => {
    it('returns an eligibility vetting artifact', async () => {
      const result = await runEligibilityVetting('grant-456');

      expect(result.artifact.artifactType).toBe('eligibility-vetting');
      expect(result.artifact.jobId).toBe('ev-test-id');
      expect(result.artifact.grantId).toBe('grant-456');
      expect(result.artifact.status).toBe('meets-all');
      expect(result.artifact.missingRequirements).toEqual([]);
      expect(result.artifact.checks).toHaveLength(3);
      expect(result.artifact.checks[0]!.met).toBe(true);
    });
  });
});
