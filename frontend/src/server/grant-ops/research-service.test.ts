/**
 * Research Service Tests (TDD)
 *
 * These tests guard the missing behaviors identified in the analysis:
 * - runResearch persists crawlRun metadata (completedAt, status, grantsFound, grantsMatched)
 * - runResearch updates source lastCrawledAt after successful crawl
 * - runResearch leaves grants ranked so discovery can sort by fit/deadline/award
 *
 * Uses isolated test data directory for proper test isolation.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { truncateDatabase, getSqliteState } from '../../../../shared/grant-ops-sqlite';
import type { OrganizationProfile } from '../../../../shared/types';
import { createDependencies, resetDependencies, setDependencies } from './dependencies';
import type { OpencodeAdapter } from './opencode-client';
import * as repository from './repository';
import * as researchService from './research-service';
import { NoSourcesConfiguredError } from './research-service';
import * as sourceService from './source-service';

function buildStrictFixture(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    fitRubric: {
      missionAlignment: { score: 80, justification: 'mission alignment' },
      geographicFocus: { score: 80, justification: 'bay area' },
      programTrackrecord: { score: 80, justification: 'past delivery' },
      budgetCapacity: { score: 80, justification: 'within band' },
      partnershipReadiness: { score: 80, justification: 'partnerships' },
      overallRationale: 'good fit overall',
      rubricVersion: 1,
    },
    changeClass: 'new',
    evidence: { eligibility: 'open to 501(c)(3) community programs' },
    lastSeenConfirmed: true,
    ...overrides,
  };
}

const mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo',
  ein: '12-3456789',
  samUEI: 'XyxabC123AB',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,
  contactInfo: {},
  geography: 'Regional',
  mission: 'To support tech education and community innovation',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],
  docTypes: ['501(c)(3) letter', 'SAM registration', 'Organizational budget'],
  searchThemes: ['EdTech', 'Community Innovation', 'Science & Tech'],
  agentBehavior: {
    autoDraftThreshold: 80,
    submissionPolicy: 'human-review-required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'professional',
  },
};

// Crawl ingestion now visits each grant's source URL to drop dead 404 links. Stub fetch
// file-wide so fixtures with a url are treated as live, with no real network calls.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status: 200, body: { cancel: async () => {} } })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResearchService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;

  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });

  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });

  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
  });

  describe('runResearch with zero sources', () => {
    it('registers ProPublica as a default source and proceeds without NoSourcesConfiguredError', async () => {
      // No sources manually added — ProPublica is registered automatically by runResearch
      let caughtError: Error | null = null;
      try {
        await researchService.runResearch(mockProfile, {
          _providerType: 'fake',
        });
      } catch (error) {
        caughtError = error as Error;
      }

      // ProPublica is always registered, so NoSourcesConfiguredError is never thrown
      expect(caughtError).not.toBeInstanceOf(NoSourcesConfiguredError);

      // ProPublica should now be registered in the repository
      const sources = await repository.getSources();
      expect(sources.some((s) => s.name === 'ProPublica Nonprofit Explorer')).toBe(true);
    });
  });

  describe('ProPublica default source registration', () => {
    it('registers ProPublica source in repository before getActiveSources() is called', async () => {
      // Start with empty sources — ProPublica should be registered automatically
      try {
        await researchService.runResearch(mockProfile, { _providerType: 'fake' });
      } catch {
        // Ignore errors — what matters is ProPublica gets registered before source query
      }
      // Whether research succeeded or failed, ProPublica should be in the repository
      const sources = await repository.getSources();
      expect(sources.some((s) => s.name === 'ProPublica Nonprofit Explorer')).toBe(true);
    });
  });

  describe('runResearch persistence', () => {
    beforeEach(async () => {
      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({
              success: true,
              content: JSON.stringify({
                grants: [
                  buildStrictFixture({
                    id: 'mock-grant-001',
                    title: 'Mock Foundation Grant',
                    url: 'https://example.com/mock-foundation-grant',
                    funder: 'Mock Foundation',
                    funderShort: 'MF',
                    award: '$10,000',
                    awardSort: 10000,
                    deadline: '2026-09-30',
                    daysOut: 127,
                    fit: 80,
                    tags: ['funding', 'tech'],
                  }),
                ],
              }),
            }),
            generateDraft: async () => ({
              success: true,
              content: JSON.stringify({ version: 1, draftContent: '' }),
            }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );
    });

    it('FAILS: runResearch should persist crawlRun with completedAt after successful crawl', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // The crawlRun should have completedAt set
      expect(result.crawlRun.completedAt).toBeDefined();
      expect(result.crawlRun.completedAt).not.toBeNull();

      const latestRun = await repository.getLatestCrawlRun();
      expect(latestRun?.completedAt).toBeDefined();
      expect(latestRun?.status).toBe('completed');
    });

    it('FAILS: runResearch should persist crawlRun with status completed', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // Status should be completed
      expect(result.crawlRun.status).toBe('completed');
    });

    it('FAILS: runResearch should persist crawlRun with grantsFound count', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // grantsFound should be set and non-negative
      expect(result.crawlRun.grantsFound).toBeGreaterThanOrEqual(0);
    });

    it('FAILS: runResearch should persist crawlRun with grantsMatched count', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // grantsMatched should be set and non-negative
      expect(result.crawlRun.grantsMatched).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runResearch source lastCrawledAt', () => {
    beforeEach(async () => {
      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({
              success: true,
              content: JSON.stringify({
                grants: [
                  buildStrictFixture({
                    id: 'mock-grant-001',
                    title: 'Mock Foundation Grant',
                    url: 'https://example.com/mock-foundation-grant',
                    funder: 'Mock Foundation',
                    funderShort: 'MF',
                    award: '$10,000',
                    awardSort: 10000,
                    deadline: '2026-09-30',
                    daysOut: 127,
                    fit: 80,
                    tags: ["funding", "tech"],
                  }),
                ],
              }),
            }),
            generateDraft: async () => ({
              success: true,
              content: JSON.stringify({ version: 1, draftContent: '' }),
            }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );
    });

    it('sets source lastCrawledAt after a crawl attempt completes', async () => {
      const source = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      const sourcesBefore = await sourceService.getAllSources();
      const sourceBefore = sourcesBefore.find((s) => s.id === source.id);
      expect(sourceBefore?.lastCrawledAt).toBeUndefined();

      await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      const sourcesAfter = await sourceService.getAllSources();
      const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
      expect(sourceAfter?.lastCrawledAt).toBeDefined();
      expect(sourceAfter?.lastCrawledAt).not.toBeNull();
    });

    it('stamps source lastCrawledAt even when a crawl returns no grants', async () => {
      const source = await sourceService.addSource({
        name: 'No Grant Source',
        url: 'https://example.com/empty',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({ success: false, error: 'No results' }),
            generateDraft: async () => ({ success: false, error: 'not used' }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );

      await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      const sourcesAfter = await sourceService.getAllSources();
      const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
      expect(sourceAfter?.lastCrawledAt).toBeDefined();
    });

    it('runResearch should not mutate existing matched grants when research returns no grants', async () => {
      const source = await sourceService.addSource({
        name: 'Empty Content Source',
        url: 'https://example.com/empty',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });
      const existingGrant = {
        id: `existing-grant-${Date.now()}`,
        title: 'Existing Grant',
        funder: 'Existing Funder',
        funderShort: 'EF',
        award: '$10,000',
        awardSort: 10000,
        deadline: '2026-12-31',
        daysOut: 200,
        fit: 90,
        tags: ['Community'],
        status: 'matched' as const,
        statusLabel: 'Matched',
        sourceCount: 2,
      };
      await repository.addGrant(existingGrant);

      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({
              success: true,
              content: JSON.stringify({ grants: [], evidence: [], rationale: 'No new grants' }),
            }),
            generateDraft: async () => ({ success: true, content: '' }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );

      await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      const grantsAfter = await repository.getGrants();
      const updatedGrant = grantsAfter.find((grant) => grant.id === existingGrant.id);
      expect(updatedGrant?.sourceCount).toBe(2);

      const sourcesAfter = await sourceService.getAllSources();
      const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
      expect(sourceAfter?.lastCrawledAt).toBeDefined();
    });

    it('runResearch should stamp lastCrawledAt even when a successful crawl returns empty content', async () => {
      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({ success: true, content: '' }),
            generateDraft: async () => ({ success: true, content: '' }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );

      const source = await sourceService.addSource({
        name: 'Empty Content Source',
        url: 'https://example.com/empty',
        type: 'website',
        reviewStatus: 'approved', // Must be approved to be included in research
      });

      await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      const sourcesAfter = await sourceService.getAllSources();
      const sourceAfter = sourcesAfter.find((s) => s.id === source.id);
      expect(sourceAfter?.lastCrawledAt).toBeDefined();
    });
  });

  describe('runResearch ranked grants for discovery sorting', () => {
    beforeEach(async () => {
      setDependencies(
        createDependencies({
          createOpencodeAdapter: () => ({
            executeResearch: async () => ({
              success: true,
              content: JSON.stringify({
                grants: [
                  buildStrictFixture({
                    id: 'mock-grant-001',
                    title: 'Mock Foundation Grant',
                    url: 'https://example.com/mock-foundation-grant',
                    funder: 'Mock Foundation',
                    funderShort: 'MF',
                    award: '$10,000',
                    awardSort: 10000,
                    deadline: '2026-09-30',
                    daysOut: 127,
                    fit: 80,
                    tags: ["funding", "tech"],
                  }),
                ],
              }),
            }),
            generateDraft: async () => ({
              success: true,
              content: JSON.stringify({ version: 1, draftContent: '' }),
            }),
            
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
          }),
        }),
      );
    });

    it('FAILS: runResearch should leave grants with fit scores for fit sorting', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved',
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // Grants found should be accessible for sorting
      expect(result.grantsFound >= 0).toBe(true);

      // Get grants and verify they have fit scores
      const grants = await repository.getGrants();
      if (grants.length > 0) {
        const matchedGrants = grants.filter((g) => g.status === 'matched');
        for (const grant of matchedGrants) {
          expect(grant.fit).toBeGreaterThan(0);
        }
      }

      const researchedGrant = grants.find((grant) => grant.funder === 'Mock Foundation');
      expect(researchedGrant?.funderSummary).toContain('Mock Foundation');
      expect(researchedGrant?.fitBreakdown).toBeDefined();
      // sourceCount reflects all registered sources
      expect(researchedGrant?.sourceCount).toBe(15);
      expect(researchedGrant?.groundedDocumentCount).toBe(0);
      expect(researchedGrant?.latestDraftVersion).toBe(0);
      expect(researchedGrant?.checklist?.length).toBeGreaterThan(0);
    });

    it('FAILS: runResearch should leave grants with deadline info for deadline sorting', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved',
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // The research result should indicate grants were found
      expect(result.grantsFound >= 0).toBe(true);

      // Get grants and verify they have deadline info
      const grants = await repository.getGrants();
      if (grants.length > 0) {
        const matchedGrants = grants.filter((g) => g.status === 'matched');
        for (const grant of matchedGrants) {
          expect(grant.deadline).toBeDefined();
        }
      }
    });

    it('FAILS: runResearch should leave grants with award amounts for award sorting', async () => {
      // Add a test source
      await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved',
      });

      // Run research
      const result = await researchService.runResearch(mockProfile, {
        _providerType: 'fake',
      });

      // The research result should indicate grants were found
      expect(result.grantsFound >= 0).toBe(true);

      // Get grants and verify they have award amounts
      const grants = await repository.getGrants();
      if (grants.length > 0) {
        const matchedGrants = grants.filter((g) => g.status === 'matched');
        for (const grant of matchedGrants) {
          expect(grant.awardSort).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});

describe('rubric + last-seen + last-updated + archive invariants', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;
  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });
  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });
  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
  });

  it('persisted grant carries the full fitRubric and lastSeenAt === lastUpdatedAt === matchedAt', async () => {
    const fixture = buildStrictFixture({
      id: 'rubric-001',
      title: 'Rubric Test Grant',
      url: 'https://example.com/rubric-001',
      funder: 'Rubric Foundation',
      funderShort: 'RF',
      award: '$25,000',
      awardSort: 25000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 80,
      tags: ['STEM'],
    });
    const fixedClock = new Date('2026-06-01T10:00:00.000Z');
    setDependencies(
      createDependencies({
        clock: { now: () => fixedClock },
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({ grants: [fixture], evidence: [], rationale: 'ok' }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          executePeerDiscovery: async () => ({ success: true, content: '{}' }),
          executeFunderInsights: async () => ({ success: true, content: '{}' }),
          executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
          isConfigured: () => true,
        }),
      }),
    );
    await sourceService.addSource({
      name: 'Rubric Source',
      url: 'https://example.com/rubric-source',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grants = await repository.getGrants();
    const persisted = grants.find((g) => g.id === 'rubric-001');
    expect(persisted).toBeDefined();
    expect(persisted?.fitRubric?.overallRationale).toBe('good fit overall');
    expect(persisted?.fitRubric?.missionAlignment.score).toBe(80);
    expect(persisted?.lastSeenAt).toBeDefined();
    expect(persisted?.lastUpdatedAt).toBeDefined();
    expect(persisted?.lastSeenAt).toBe(persisted?.lastUpdatedAt);
    expect(persisted?.lastSeenAt).toBe(persisted?.matchedAt);
  });

  it('second run with identical data bumps only lastSeenAt and emits grant_unchanged', async () => {
    const fixture = buildStrictFixture({
      id: 'rubric-unchanged-001',
      title: 'Unchanged Grant',
      url: 'https://example.com/unchanged-001',
      funder: 'Unchanged Foundation',
      funderShort: 'UF',
      award: '$10,000',
      awardSort: 10000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 80,
      tags: ['STEM'],
    });
    let firstSeenAt: string | undefined;
    let firstUpdatedAt: string | undefined;
    let clockValue = new Date('2026-06-01T10:00:00.000Z');

    setDependencies(
      createDependencies({
        clock: { now: () => clockValue },
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({ grants: [fixture], evidence: [], rationale: 'ok' }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          executePeerDiscovery: async () => ({ success: true, content: '{}' }),
          executeFunderInsights: async () => ({ success: true, content: '{}' }),
          executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
          isConfigured: () => true,
        }),
      }),
    );

    await sourceService.addSource({
      name: 'Unchanged Source',
      url: 'https://example.com/unchanged-source',
      type: 'website',
      reviewStatus: 'approved',
    });

    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const firstGrant = (await repository.getGrants()).find((g) => g.id === 'rubric-unchanged-001');
    firstSeenAt = firstGrant?.lastSeenAt;
    firstUpdatedAt = firstGrant?.lastUpdatedAt;
    expect(firstSeenAt).toBeDefined();
    expect(firstUpdatedAt).toBe(firstSeenAt);

    // Advance the clock so the second run produces a different timestamp.
    clockValue = new Date('2026-06-01T10:00:30.000Z');
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const secondGrant = (await repository.getGrants()).find((g) => g.id === 'rubric-unchanged-001');
    expect(secondGrant?.lastSeenAt).not.toBe(firstSeenAt);
    expect(secondGrant?.lastUpdatedAt).toBe(firstUpdatedAt);

    const events = await repository.getAuditEvents();
    const unchanged = events
      .filter((e) => e.entityId === 'rubric-unchanged-001')
      .filter((e) => e.eventType === 'grant_unchanged');
    expect(unchanged.length).toBeGreaterThan(0);
  });

  it('second run with a changed deadline bumps lastUpdatedAt and emits grant_updated', async () => {
    const fixture1 = buildStrictFixture({
      id: 'rubric-updated-001',
      title: 'Updated Grant',
      url: 'https://example.com/updated-001',
      funder: 'Updated Foundation',
      funderShort: 'UPD',
      award: '$15,000',
      awardSort: 15000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 80,
      tags: ['STEM'],
    });
    const fixture2 = {
      ...fixture1,
      deadline: '2026-10-30',
      daysOut: 157,
    };

    let runIndex = 0;
    let clockValue = new Date('2026-06-01T10:00:00.000Z');
    setDependencies(
      createDependencies({
        clock: { now: () => clockValue },
        createOpencodeAdapter: () => ({
          executeResearch: async () => {
            // Use a closure variable that increments once per runResearch call.
            // Each source within a run consumes the same fixture (ProPublica is the only other source).
            const fixtures = runIndex === 0 ? [fixture1] : [fixture2];
            const json = JSON.stringify({ grants: fixtures, evidence: [], rationale: 'ok' });
            return { success: true, content: json };
          },
          generateDraft: async () => ({ success: true, content: '' }),
          executePeerDiscovery: async () => ({ success: true, content: '{}' }),
          executeFunderInsights: async () => ({ success: true, content: '{}' }),
          executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
          isConfigured: () => true,
        }),
      }),
    );

    await sourceService.addSource({
      name: 'Updated Source',
      url: 'https://example.com/updated-source',
      type: 'website',
      reviewStatus: 'approved',
    });

    runIndex = 0;
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const firstGrant = (await repository.getGrants()).find((g) => g.id === 'rubric-updated-001');
    const firstUpdatedAt = firstGrant?.lastUpdatedAt;
    expect(firstUpdatedAt).toBeDefined();
    expect(firstGrant?.deadline).toBe('2026-09-30');

    runIndex = 1;
    clockValue = new Date('2026-06-01T10:00:30.000Z');
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const secondGrant = (await repository.getGrants()).find((g) => g.id === 'rubric-updated-001');
    expect(secondGrant?.lastUpdatedAt).not.toBe(firstUpdatedAt);
    expect(secondGrant?.deadline).toBe('2026-10-30');

    const events = await repository.getAuditEvents();
    const updated = events
      .filter((e) => e.entityId === 'rubric-updated-001')
      .filter((e) => e.eventType === 'grant_updated');
    expect(updated.length).toBeGreaterThan(0);
  });

  it('archived grant is skipped byte-for-byte on the next run (no audit events for entityId)', async () => {
    const fixture = buildStrictFixture({
      id: 'rubric-archived-001',
      title: 'Archived Grant',
      url: 'https://example.com/archived-001',
      funder: 'Archived Foundation',
      funderShort: 'AF',
      award: '$5,000',
      awardSort: 5000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 80,
      tags: ['STEM'],
    });
    let clockValue = new Date('2026-06-01T10:00:00.000Z');
    setDependencies(
      createDependencies({
        clock: { now: () => clockValue },
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({ grants: [fixture], evidence: [], rationale: 'ok' }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          executePeerDiscovery: async () => ({ success: true, content: '{}' }),
          executeFunderInsights: async () => ({ success: true, content: '{}' }),
          executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
          isConfigured: () => true,
        }),
      }),
    );

    await sourceService.addSource({
      name: 'Archived Source',
      url: 'https://example.com/archived-source',
      type: 'website',
      reviewStatus: 'approved',
    });

    // First run: grant is created
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const firstGrant = (await repository.getGrants()).find((g) => g.id === 'rubric-archived-001');
    expect(firstGrant).toBeDefined();

    // Archive it
    await repository.updateGrant('rubric-archived-001', {
      status: 'archived',
      statusLabel: 'Archived',
      archivedAt: '2026-06-01T00:00:00.000Z',
    });
    const snapshot = JSON.parse(JSON.stringify(await repository.getGrant('rubric-archived-001')));

    // Second run: identical data, later clock. Grant must be untouched.
    clockValue = new Date('2026-06-01T10:00:30.000Z');
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const after = await repository.getGrant('rubric-archived-001');
    expect(after).toEqual(snapshot);
    expect(after?.lastSeenAt).toBe(snapshot?.lastSeenAt);

    // No audit events for the archived grant entityId from the second run onward.
    const allEvents = await repository.getAuditEvents();
    const archivedEvents = allEvents.filter((e) => e.entityId === 'rubric-archived-001');
    // The first run emitted exactly one grant_created event; nothing more.
    expect(archivedEvents.filter((e) => e.eventType === 'grant_created').length).toBe(1);
    expect(archivedEvents.filter((e) => e.eventType === 'grant_updated').length).toBe(0);
    // The skip-archived guard ensures the second run emits zero additional
    // grant_unchanged events beyond what the first run emitted. ProPublica
    // is auto-registered and other seed sources each take a turn on the
    // first run (N sources = N unchanged events on the first run); the
    // archive is set BETWEEN the two runs, so the second run must add 0.
    const unchangedTotal = archivedEvents.filter((e) => e.eventType === 'grant_unchanged').length;
    const createdAfterArchive = allEvents
      .filter((e) => e.eventType === 'grant_unchanged')
      .filter((e) => Date.parse(e.timestamp) >= Date.parse('2026-06-01T10:00:30.000Z'))
      .filter((e) => e.entityId === 'rubric-archived-001');
    expect(createdAfterArchive.length).toBe(0);
    expect(unchangedTotal).toBeGreaterThan(0); // the first run still emitted some
  });

  it('a grant without a fitRubric is dropped with a warn log; well-formed grant is persisted', async () => {
    const validGrant = buildStrictFixture({
      id: 'rubric-valid-001',
      title: 'Valid Grant',
      url: 'https://example.com/valid-001',
      funder: 'Valid Foundation',
      funderShort: 'VF',
      award: '$10,000',
      awardSort: 10000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 80,
      tags: ['STEM'],
    });
    const invalidGrant = {
      id: 'rubric-invalid-001',
      title: 'Invalid Grant',
      url: 'https://example.com/invalid-001',
      funder: 'Invalid Foundation',
      award: '$1,000',
      awardSort: 1000,
      deadline: '2026-09-30',
      daysOut: 127,
      fit: 50,
      tags: [],
      // missing fitRubric
    };
    setDependencies(
      createDependencies({
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({
              grants: [validGrant, invalidGrant],
              evidence: [],
              rationale: 'mix',
            }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          executePeerDiscovery: async () => ({ success: true, content: '{}' }),
          executeFunderInsights: async () => ({ success: true, content: '{}' }),
          executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
          isConfigured: () => true,
        }),
      }),
    );
    await sourceService.addSource({
      name: 'Mix Source',
      url: 'https://example.com/mix-source',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grants = await repository.getGrants();
    expect(grants.find((g) => g.id === 'rubric-valid-001')).toBeDefined();
    expect(grants.find((g) => g.id === 'rubric-invalid-001')).toBeUndefined();
  });
});

describe('auto-draft triggering', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;
  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });
  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });
  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
  });

  it('does not auto-draft during research, grants remain matched', async () => {
    await sourceService.addSource({
      name: 'Test Source',
      url: 'https://example.com/grants',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grants = await repository.getGrants();
    const mockGrant = grants.find((g) => g.id === 'mock-grant-001');
    expect(mockGrant?.status).toBe('matched');
    expect(mockGrant?.latestDraftVersion).toBe(0);
  });

  it('persists multiple aligned grants from a single crawl', async () => {
    setDependencies(
      createDependencies({
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({
              grants: [
                {
                  id: 'multi-grant-001',
                  title: 'Community Innovation Grant',
                  url: 'https://example.com/community-innovation-grant',
                  funder: 'Mock Foundation',
                  funderShort: 'MF',
                  award: '$10,000',
                  awardSort: 10000,
                  deadline: '2026-09-30',
                  daysOut: 127,
                  fit: 84,
                  tags: ['Community'],
                  fitRubric: {
                    missionAlignment: { score: 84, justification: 'mission alignment' },
                    geographicFocus: { score: 84, justification: 'bay area' },
                    programTrackrecord: { score: 84, justification: 'past delivery' },
                    budgetCapacity: { score: 84, justification: 'within band' },
                    partnershipReadiness: { score: 84, justification: 'partnerships' },
                    overallRationale: 'good fit overall',
                    rubricVersion: 1,
                  },
                  changeClass: 'new',
                  evidence: { eligibility: 'open' },
                  lastSeenConfirmed: true,
                },
                {
                  id: 'multi-grant-002',
                  title: 'Education Innovation Grant',
                  url: 'https://example.com/education-innovation-grant',
                  funder: 'Alliance for Learning',
                  funderShort: 'Alliance',
                  award: '$25,000',
                  awardSort: 25000,
                  deadline: '2026-10-30',
                  daysOut: 157,
                  fit: 77,
                  tags: ['Education'],
                  fitRubric: {
                    missionAlignment: { score: 77, justification: 'mission alignment' },
                    geographicFocus: { score: 77, justification: 'bay area' },
                    programTrackrecord: { score: 77, justification: 'past delivery' },
                    budgetCapacity: { score: 77, justification: 'within band' },
                    partnershipReadiness: { score: 77, justification: 'partnerships' },
                    overallRationale: 'good fit overall',
                    rubricVersion: 1,
                  },
                  changeClass: 'new',
                  evidence: { eligibility: 'open' },
                  lastSeenConfirmed: true,
                },
              ],
              evidence: [],
              rationale: 'Multiple aligned grants',
            }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
        }),
      }),
    );

    await sourceService.addSource({
      name: 'Test Source',
      url: 'https://example.com/grants',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grants = await repository.getGrants();
    const mockFoundationGrant = grants.find((g) => g.id === 'multi-grant-001');
    const allianceGrant = grants.find((g) => g.id === 'multi-grant-002');
    expect(mockFoundationGrant?.researchRationale).toBe('Multiple aligned grants');
    expect(allianceGrant?.status).toBe('matched');
    // sourceCount is 15: 13 seed sources + 2 test sources
    expect(mockFoundationGrant?.sourceCount).toBe(15);
    expect(allianceGrant?.sourceCount).toBe(15);
  });

  it('research creates matched grants for both high-fit and low-fit results', async () => {
    setDependencies(
      createDependencies({
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({
              grants: [
                {
                  id: 'grant-low-fit',
                  title: 'Low Fit Grant',
                  url: 'https://example.com/low-fit-grant',
                  funder: 'Low Foundation',
                  funderShort: 'LF',
                  award: '$1,000',
                  awardSort: 1000,
                  deadline: '2026-12-31',
                  daysOut: 200,
                  fit: 70,
                  tags: [],
                  fitRubric: {
                    missionAlignment: { score: 70, justification: 'mission alignment' },
                    geographicFocus: { score: 70, justification: 'bay area' },
                    programTrackrecord: { score: 70, justification: 'past delivery' },
                    budgetCapacity: { score: 70, justification: 'within band' },
                    partnershipReadiness: { score: 70, justification: 'partnerships' },
                    overallRationale: 'good fit overall',
                    rubricVersion: 1,
                  },
                  changeClass: 'new',
                  evidence: { eligibility: 'open' },
                  lastSeenConfirmed: true,
                },
              ],
            }),
          }),
          generateDraft: async () => ({
            success: true,
            content: JSON.stringify({ version: 1, draftContent: '' }),
          }),
          
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
        }),
      }),
    );
    await sourceService.addSource({
      name: 'Test Source',
      url: 'https://example.com/grants',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grants = await repository.getGrants();
    const lowFitGrant = grants.find((g) => g.id === 'grant-low-fit');
    expect(lowFitGrant?.status).toBe('matched');
    expect(lowFitGrant?.latestDraftVersion).toBe(0);
  });

  it('research run does not change grant status on repeat runs when grant already exists', async () => {
    await sourceService.addSource({
      name: 'Test Source',
      url: 'https://example.com/grants',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grantsAfterFirst = await repository.getGrants();
    const grantAfterFirst = grantsAfterFirst.find((g) => g.id === 'mock-grant-001');
    expect(grantAfterFirst?.status).toBe('matched');
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const grantsAfterSecond = await repository.getGrants();
    const grantAfterSecond = grantsAfterSecond.find((g) => g.id === 'mock-grant-001');
    expect(grantAfterSecond?.status).toBe('matched');
    // sourceCount is 30: 15 sources per run × 2 runs
    expect(grantAfterSecond?.sourceCount).toBe(30);
  });
});

describe('per-grant and summary notifications during research', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;
  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });
  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });
  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
  });

  it('emits accent notification with escaped strong title, award, and fit for each new matching grant AND suppresses auto-draft notification', async () => {
    await sourceService.addSource({
      name: 'Test',
      url: 'https://example.com',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const notifications = await repository.getNotifications();
    expect(notifications.some((n) => n.dot === 'accent' && /New match/i.test(n.text))).toBe(true);
    const perGrantNotif = notifications.find(
      (n) => n.dot === 'accent' && /New match/i.test(n.text),
    );
    if (!perGrantNotif) {
      throw new Error('Expected per-grant notification');
    }
    expect(perGrantNotif.text).toContain('<strong>');
    expect(perGrantNotif.text).toContain('Mock Foundation');
    expect(perGrantNotif.text).toContain('$50,000');
    expect(perGrantNotif.text).toContain('fit 82');
    expect(notifications.some((n) => /Draft generated/i.test(n.text))).toBe(false);
  });

  it('retains prior notifications and orders per-grant before summary before prior', async () => {
    await repository.updateNotifications([
      { id: 'prior-1', dot: 'info', time: '2026-01-01T00:00:00.000Z', text: 'Prior notification' },
    ]);
    await sourceService.addSource({
      name: 'Test',
      url: 'https://example.com',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const notifications = await repository.getNotifications();
    expect(notifications.some((n) => n.text === 'Prior notification')).toBe(true);
    const perGrantIdx = notifications.findIndex(
      (n) => n.dot === 'accent' && /New match/i.test(n.text),
    );
    const summaryIdx = notifications.findIndex((n) => /research completed/i.test(n.text));
    const priorIdx = notifications.findIndex((n) => n.text === 'Prior notification');
    expect(perGrantIdx).toBeGreaterThanOrEqual(0);
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    expect(priorIdx).toBeGreaterThanOrEqual(0);
    expect(perGrantIdx).toBeLessThan(summaryIdx);
    expect(summaryIdx).toBeLessThan(priorIdx);
    expect(notifications.some((n) => /Draft generated/i.test(n.text))).toBe(false);
  });
});

describe('notification emission', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;
  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });
  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });
  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
  });
  it('emits a notification after runResearch completes', async () => {
    await sourceService.addSource({
      name: 'Test',
      url: 'https://example.com',
      type: 'website',
      reviewStatus: 'approved',
    });
    await researchService.runResearch(mockProfile, { _providerType: 'fake' });
    const notifications = await repository.getNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications[0]).toBeDefined();
    expect(notifications[0]?.dot).toBeDefined();
    expect(notifications.some((n) => /research completed/i.test(n.text))).toBe(true);
  });
});

describe('PATH-fallback: no early isConfigured throw', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;
  let state: ReturnType<typeof getSqliteState>;
  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });
  afterAll(async () => {
    await tempDataDir.cleanup();
    resetDependencies();
  });
  beforeEach(async () => {
    await truncateDatabase(state);
    invalidateCache();
    resetDependencies();
    setDependencies(
      createDependencies({
        createOpencodeAdapter: () => ({
          executeResearch: async () => ({
            success: true,
            content: JSON.stringify({
              grants: [
                {
                  id: 'mock-grant-001',
                  title: 'Mock Foundation Grant',
                  url: 'https://example.com/mock-foundation-grant',
                  funder: 'Mock Foundation',
                  award: '$10,000',
                  awardSort: 10000,
                  deadline: '2026-09-30',
                  daysOut: 127,
                  fit: 80,
                  tags: ['funding', 'tech'],
                },
              ],
            }),
          }),
          generateDraft: async () => ({ success: true, content: '' }),
          
            executePeerDiscovery: async () => ({ success: true, content: JSON.stringify({ artifactType: 'peer-discovery', jobId: 'test', timestamp: new Date().toISOString(), results: [], organizationsAnalyzed: 0 }) }),
            executeFunderInsights: async () => ({ success: true, content: JSON.stringify({ artifactType: 'funder-insights', jobId: 'test', funderId: 'test', timestamp: new Date().toISOString(), patterns: [] }) }),
            executeEligibilityVetting: async () => ({ success: true, content: JSON.stringify({ artifactType: 'eligibility-vetting', jobId: 'test', grantId: 'test', timestamp: new Date().toISOString(), status: 'meets-all', missingRequirements: [], checks: [] }) }),
                    isConfigured: () => true,
        }),
      }),
    );
  });

  it('proceeds without early throw when settings are present (isConfigured check delegated to adapter)', async () => {
    // The early isConfigured throw was removed from runResearch.
    // The service now creates the adapter and lets the adapter
    // handle configuration checks at runtime.
    await sourceService.addSource({
      name: 'Test',
      url: 'https://example.com',
      type: 'website',
      reviewStatus: 'approved',
    });
    const result = await researchService.runResearch(mockProfile, {
      _providerType: 'fake',
    });
    expect(result).toBeDefined();
    expect(result.crawlRun.status).toBe('completed');
  });

  describe('honest crawl status and validation reprompt', () => {
    const setAdapter = (executeResearch: OpencodeAdapter['executeResearch']): void => {
      const adapter = {
        executeResearch,
        generateDraft: async () => ({ success: true, content: '' }),
        executePeerDiscovery: async () => ({ success: true, content: '{}' }),
        executeFunderInsights: async () => ({ success: true, content: '{}' }),
        executeEligibilityVetting: async () => ({ success: true, content: '{}' }),
        isConfigured: () => true,
      } as unknown as OpencodeAdapter;
      setDependencies(createDependencies({ createOpencodeAdapter: () => adapter }));
    };

    const addApprovedSource = async (name: string): Promise<void> => {
      await sourceService.addSource({
        name,
        url: `https://example.com/${encodeURIComponent(name)}`,
        type: 'website',
        reviewStatus: 'approved',
      });
    };

    it('marks the run failed (with errorMessage) when the only source times out', async () => {
      setAdapter(async () => ({
        success: false,
        failureMode: 'timeout',
        error: 'Opencode timed out after 60000ms',
      }));
      await addApprovedSource('Timeout Source');

      const result = await researchService.runResearch(mockProfile);

      expect(result.crawlRun.status).toBe('failed');
      expect(result.crawlRun.errorMessage).toBeTruthy();
      expect(result.error).toContain('timeout');
    });

    it('reports partial-results when some sources fail and some succeed', async () => {
      let call = 0;
      setAdapter(async () => {
        call += 1;
        if (call === 1) {
          return { success: false, failureMode: 'timeout', error: 'timed out' };
        }
        return {
          success: true,
          content: JSON.stringify({
            grants: [
              { title: 'Good Grant', funder: 'Good Funder', url: 'https://example.com/good-grant' },
            ],
            evidence: [],
            rationale: 'ok',
          }),
        };
      });
      await addApprovedSource('Failing Source');
      await addApprovedSource('Working Source');

      const result = await researchService.runResearch(mockProfile);

      expect(result.crawlRun.status).toBe('partial-results');
      expect(result.crawlRun.errorMessage).toContain('1 of');
    });

    it('treats valid output with zero grants as success, not failure', async () => {
      setAdapter(async () => ({
        success: true,
        content: JSON.stringify({ grants: [], evidence: [], rationale: 'no matches' }),
      }));
      await addApprovedSource('Empty Source');

      const result = await researchService.runResearch(mockProfile);

      expect(result.crawlRun.status).toBe('completed');
      expect(result.grantsMatched).toBe(0);
    });

    it('reprompts once and succeeds when the first output is not valid JSON', async () => {
      let call = 0;
      setAdapter(async () => {
        call += 1;
        if (call === 1) {
          return { success: true, content: 'this is not json at all' };
        }
        return {
          success: true,
          content: JSON.stringify({
            grants: [
              {
                title: 'Recovered Grant',
                funder: 'Recovered Funder',
                url: 'https://example.com/recovered-grant',
                fitRubric: {
                  missionAlignment: { score: 80, justification: 'mission alignment' },
                  geographicFocus: { score: 80, justification: 'bay area' },
                  programTrackrecord: { score: 80, justification: 'past delivery' },
                  budgetCapacity: { score: 80, justification: 'within band' },
                  partnershipReadiness: { score: 80, justification: 'partnerships' },
                  overallRationale: 'good fit overall',
                  rubricVersion: 1,
                },
                changeClass: 'new',
                evidence: { eligibility: 'open' },
                lastSeenConfirmed: true,
              },
            ],
            evidence: [],
            rationale: 'fixed',
          }),
        };
      });
      await addApprovedSource('Flaky Source');

      const result = await researchService.runResearch(mockProfile);

      // First source's invalid output triggers a reprompt (>=2 calls). ProPublica is
      // auto-registered as an extra source, so the exact count is >= 2, not exactly 2.
      expect(call).toBeGreaterThanOrEqual(2); // proved the reprompt happened
      expect(result.crawlRun.status).toBe('completed');
      expect(result.grantsMatched).toBe(1);
    });

    it('fails the source (parse-error) when output never becomes valid JSON', async () => {
      setAdapter(async () => ({ success: true, content: 'still not json' }));
      await addApprovedSource('Broken Source');

      const result = await researchService.runResearch(mockProfile);

      expect(result.crawlRun.status).toBe('failed');
      expect(result.crawlRun.errorMessage).toContain('parse-error');
      expect(result.grantsMatched).toBe(0);
    });
  });
});
