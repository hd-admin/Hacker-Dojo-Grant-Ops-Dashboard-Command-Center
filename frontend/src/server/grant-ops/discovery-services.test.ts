import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  runPeerDiscovery,
  runFunderInsights,
  runEligibilityVetting,
} from './discovery-services';
import { createDependencies, setDependencies, resetDependencies } from './dependencies';
import { withTempDataDir, invalidateCache } from '../../../../shared/grant-ops-persistence';
import * as repository from './repository';

const mockClock = {
  now: () => new Date('2026-01-15T00:00:00Z'),
};

const mockIdGenerator = {
  generateId: (prefix: string) => `${prefix}-test-id`,
};

const fakeAdapter = {
  executeResearch: vi.fn(),
  generateDraft: vi.fn(),
  executePeerDiscovery: vi.fn().mockImplementation(async (request) => {
    const mockArtifact = {
      artifactType: 'peer-discovery' as const,
      jobId: 'peer-test-id',
      timestamp: new Date().toISOString(),
      results: [
        {
          funderName: `${request.query || 'Community'} Foundation`,
          funderType: 'foundation' as const,
          relevanceRationale: 'Supports community innovation hubs',
          sourceOrganization: 'Peer Organization Network',
          confidence: 0.85,
        },
      ],
      organizationsAnalyzed: 1,
    };
    return { success: true, content: JSON.stringify(mockArtifact) };
  }),
  executeFunderInsights: vi.fn().mockImplementation(async (request) => {
    const mockArtifact = {
      artifactType: 'funder-insights' as const,
      jobId: 'fi-test-id',
      funderId: request.funderId,
      timestamp: new Date().toISOString(),
      patterns: [
        {
          patternType: 'giving-trend' as const,
          description: 'Consistent support for STEM education initiatives',
          confidence: 'high' as const,
          suggestedAction: 'Apply for upcoming STEM grant cycle',
        },
      ],
      givingTrends: [
        {
          year: 2025,
          totalGiving: 5000000,
          grantsCount: 25,
          averageGrantSize: 200000,
        },
      ],
    };
    return { success: true, content: JSON.stringify(mockArtifact) };
  }),
  executeEligibilityVetting: vi.fn().mockImplementation(async (request) => {
    const mockArtifact = {
      artifactType: 'eligibility-vetting' as const,
      jobId: 'ev-test-id',
      grantId: request.grantId,
      timestamp: new Date().toISOString(),
      status: 'meets-all' as const,
      missingRequirements: [],
      recommendation: 'Organization meets all eligibility requirements for this grant.',
      checks: [
        {
          requirement: 'Nonprofit status (501(c)(3))',
          met: true,
          detail: 'Organization is a registered 501(c)(3) nonprofit.',
        },
        {
          requirement: 'Geographic eligibility',
          met: true,
          detail: 'Grant is available in the service area.',
        },
        {
          requirement: 'Budget range fit',
          met: true,
          detail: 'Requested amount is within allowable range.',
        },
      ],
    };
    return { success: true, content: JSON.stringify(mockArtifact) };
  }),
  isConfigured: vi.fn().mockReturnValue(true),
};

describe('discovery-services', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
    setDependencies(
      createDependencies({
        clock: mockClock,
        idGenerator: mockIdGenerator,
        createOpencodeAdapter: () => fakeAdapter,
      }),
    );
    await repository.updateOrgProfile({
      legalName: 'Hacker Dojo',
      ein: '12-3456789',
      samUEI: 'XyxabC123AB',
      nonprofitStatus: '501(c)(3)',
      yearFounded: 2009,
      contactInfo: {},
      geography: 'Regional',
      mission: 'Test mission',
      programAreas: ['STEM'],
      populationsServed: ['Youth'],
      fundingHistory: [],
      partnerships: [],
      complianceFacts: [],
      boardMembers: [],
      docTypes: ['PDF', 'DOCX'],
      searchThemes: ['EdTech'],
      agentBehavior: {
        autoDraftThreshold: 80,
        submissionPolicy: 'human-review-required',
        notifyEmail: 'ed@hackerdojo.com',
        voiceAndTone: 'professional',
      },
    });
    await repository.updateOpencodeSettings({
      binaryPath: '/usr/local/bin/opencode',
      workingDirectory: '/tmp/hacker-dojo',
      timeoutMs: 60000,
      profile: 'default',
      isConfigured: true,
    });
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
    invalidateCache();
  });

  describe('runPeerDiscovery', () => {
    it('returns a peer discovery artifact via the adapter', async () => {
      const result = await runPeerDiscovery('test query');

      expect(result.artifact.artifactType).toBe('peer-discovery');
      expect(result.artifact.jobId).toBe('peer-test-id');
      expect(result.artifact.timestamp).toBe('2026-01-15T00:00:00.000Z');
      expect(result.artifact.results).toHaveLength(1);
      expect(result.artifact.results[0]!.funderName).toBe('test query Foundation');
      expect(result.artifact.organizationsAnalyzed).toBe(1);
    });
  });

  describe('runFunderInsights', () => {
    it('returns a funder insights artifact via the adapter', async () => {
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
    it('returns an eligibility vetting artifact via the adapter', async () => {
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
