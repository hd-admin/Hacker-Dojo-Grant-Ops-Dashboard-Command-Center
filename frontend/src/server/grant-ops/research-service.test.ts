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
