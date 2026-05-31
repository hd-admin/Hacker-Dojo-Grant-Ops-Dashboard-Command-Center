import { describe, it, expect } from 'vitest';
import {
  ResearchArtifactSchema,
  DraftArtifactSchema,
  CrawlArtifactSchema,
  MatchArtifactSchema,
  ExtractArtifactSchema,
  PeerDiscoveryArtifactSchema,
  FunderInsightArtifactSchema,
  EligibilityVettingArtifactSchema,
  BudgetImportArtifactSchema,
} from './artifact-schemas';

// =============================
// ResearchArtifactSchema tests
// =============================

describe('ResearchArtifactSchema', () => {
  const validResearch = {
    artifactType: 'research' as const,
    jobId: 'job-001',
    timestamp: '2026-01-15T10:00:00Z',
    grants: [
      {
        title: 'Community Innovation Grant',
        funder: 'Knight Foundation',
        funderShort: 'Knight',
        award: '$250,000',
        awardSort: 250000,
        deadline: '2026-06-01',
        deadlineConfidence: 'exact' as const,
        eligibility: 'US-based 501(c)(3)',
        requirements: ['Letter of intent', 'Full proposal'],
        externalUrl: 'https://knightfoundation.org/grants/cig',
        summary: 'Supports community innovation projects',
        tags: ['innovation', 'community'],
        category: 'Foundation',
      },
    ],
    evidence: [
      {
        grantTitle: 'Community Innovation Grant',
        evidenceType: 'fit_score' as const,
        content: 'High alignment with mission',
        sourceUrl: 'https://knightfoundation.org',
      },
    ],
    rationale: 'Strong mission alignment',
    sourcesFound: 3,
    grantsFound: 1,
  };

  it('accepts valid research with grants', () => {
    const result = ResearchArtifactSchema.safeParse(validResearch);
    expect(result.success).toBe(true);
  });

  it('accepts valid research with errors but no grants (quality gate)', () => {
    const data = { ...validResearch, grants: [], grantsFound: 0, errors: ['Timeout during crawl'] };
    const result = ResearchArtifactSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects research with no grants and no errors (quality gate)', () => {
    const data = { ...validResearch, grants: [], grantsFound: 0 };
    const result = ResearchArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('grants');
    }
  });

  it('rejects research with missing artifactType', () => {
    const { artifactType: _, ...noType } = validResearch;
    const result = ResearchArtifactSchema.safeParse(noType);
    expect(result.success).toBe(false);
  });

  it('rejects grant with empty title', () => {
    const data = { ...validResearch, grants: [{ ...validResearch.grants[0], title: '' }] };
    const result = ResearchArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

// =============================
// DraftArtifactSchema tests
// =============================

describe('DraftArtifactSchema', () => {
  const sections500 = Array.from({ length: 5 }, (_, i) => ({
    sectionTitle: `Section ${i + 1}`,
    content: `Content for section ${i + 1}. `.repeat(20), // ~100 words each, 500 total
    groundingSources: ['doc-01'],
    isGrounded: i === 0, // first section is grounded
  }));

  const validDraft = {
    artifactType: 'draft' as const,
    jobId: 'job-002',
    grantId: 'grant-001',
    version: 1,
    timestamp: '2026-01-15T11:00:00Z',
    content: 'Full draft content here. '.repeat(150), // 600+ words
    sections: sections500,
    wordCount: 550,
    groundingDocumentIds: ['doc-01'],
    groundingSourceUrls: ['https://example.com/rfp'],
    notes: 'First draft',
  };

  it('accepts valid draft with grounded section and sufficient words', () => {
    const result = DraftArtifactSchema.safeParse(validDraft);
    expect(result.success).toBe(true);
  });

  it('rejects draft with wordCount < 500 (quality gate)', () => {
    const data = { ...validDraft, wordCount: 200, sections: sections500.map((s) => ({ ...s, wordCount: 40 })) };
    const result = DraftArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('wordCount');
    }
  });

  it('rejects draft with no grounded sections (quality gate)', () => {
    const data = {
      ...validDraft,
      sections: sections500.map((s) => ({ ...s, isGrounded: false })),
    };
    const result = DraftArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('sections');
    }
  });

  it('accepts draft with multiple grounded sections', () => {
    const data = {
      ...validDraft,
      sections: sections500.map((s) => ({ ...s, isGrounded: true })),
    };
    const result = DraftArtifactSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { sections: _, wordCount: __, ...minimal } = validDraft;
    const result = DraftArtifactSchema.safeParse(minimal);
    expect(result.success).toBe(false);
  });
});

// =============================
// CrawlArtifactSchema tests
// =============================

describe('CrawlArtifactSchema', () => {
  const validCrawl = {
    artifactType: 'crawl' as const,
    runId: 'run-001',
    sourceId: 'source-001',
    timestamp: '2026-01-15T12:00:00Z',
    status: 'completed' as const,
    grantsFound: [
      {
        title: 'New Grant',
        funder: 'NSF',
        award: '$500,000',
        deadline: '2026-12-01',
        url: 'https://nsf.gov/grant',
        rawText: 'Grant description text...',
      },
    ],
    pagesCrawled: 10,
    pagesFailed: 2,
  };

  it('accepts valid crawl with completed status', () => {
    expect(CrawlArtifactSchema.safeParse(validCrawl).success).toBe(true);
  });

  it('accepts partial crawl with no grants', () => {
    const data = { ...validCrawl, status: 'partial' as const, grantsFound: [] };
    expect(CrawlArtifactSchema.safeParse(data).success).toBe(true);
  });

  it('accepts failed crawl with error message', () => {
    const data = { ...validCrawl, status: 'failed' as const, grantsFound: [], errorMessage: 'Connection timeout', pagesCrawled: 0, pagesFailed: 1 };
    expect(CrawlArtifactSchema.safeParse(data).success).toBe(true);
  });

  it('rejects invalid status', () => {
    const data = { ...validCrawl, status: 'unknown' };
    expect(CrawlArtifactSchema.safeParse(data).success).toBe(false);
  });

  it('rejects negative pagesCrawled', () => {
    const data = { ...validCrawl, pagesCrawled: -1 };
    expect(CrawlArtifactSchema.safeParse(data).success).toBe(false);
  });
});

// =============================
// MatchArtifactSchema tests
// =============================

describe('MatchArtifactSchema', () => {
  const validMatch = {
    artifactType: 'match' as const,
    runId: 'match-001',
    timestamp: '2026-01-15T13:00:00Z',
    matches: [
      {
        grantTitle: 'Matching Grant A',
        grantId: 'grant-a',
        fitScore: 85,
        breakdown: {
          missionAlignment: 90,
          geographicFocus: 80,
          programTrackrecord: 85,
          budgetCapacity: 75,
          partnershipReadiness: 95,
        },
        rationale: 'Strong alignment on all dimensions',
      },
      {
        grantTitle: 'Matching Grant B',
        grantId: 'grant-b',
        fitScore: 72,
        breakdown: {
          missionAlignment: 70,
          geographicFocus: 65,
          programTrackrecord: 75,
          budgetCapacity: 80,
          partnershipReadiness: 70,
        },
        rationale: 'Good but lower alignment',
      },
    ],
    totalGrantsEvaluated: 50,
    grantsAboveThreshold: 12,
  };

  it('accepts valid match with distinct scores', () => {
    expect(MatchArtifactSchema.safeParse(validMatch).success).toBe(true);
  });

  it('accepts single match (non-identical check skipped)', () => {
    const data = { ...validMatch, matches: [validMatch.matches[0]] };
    expect(MatchArtifactSchema.safeParse(data).success).toBe(true);
  });

  it('rejects matches with all identical scores (quality gate)', () => {
    const data = {
      ...validMatch,
      matches: [
        { ...validMatch.matches[0], grantTitle: 'A', grantId: 'a' },
        { ...validMatch.matches[0], grantTitle: 'B', grantId: 'b' },
      ],
    };
    const result = MatchArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects match with fitScore > 100', () => {
    const data = {
      ...validMatch,
      matches: [{ ...validMatch.matches[0], fitScore: 150 }],
    };
    expect(MatchArtifactSchema.safeParse(data).success).toBe(false);
  });

  it('rejects match with negative fitScore', () => {
    const data = {
      ...validMatch,
      matches: [{ ...validMatch.matches[0], fitScore: -5 }],
    };
    expect(MatchArtifactSchema.safeParse(data).success).toBe(false);
  });

  it('rejects match with breakdown dimension > 100', () => {
    const data = {
      ...validMatch,
      matches: [
        {
          ...validMatch.matches[0],
          breakdown: { ...validMatch.matches[0].breakdown, missionAlignment: 200 },
        },
      ],
    };
    expect(MatchArtifactSchema.safeParse(data).success).toBe(false);
  });
});

// =============================
// ExtractArtifactSchema tests
// =============================

describe('ExtractArtifactSchema', () => {
  const validExtract = {
    artifactType: 'extract' as const,
    jobId: 'job-003',
    grantId: 'grant-001',
    timestamp: '2026-01-15T14:00:00Z',
    extracted: {
      amount: '$250,000',
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      reportingDeadlines: ['Quarterly reports due 15th'],
      complianceRequirements: ['Financial audit required'],
      budgetCategories: [
        { category: 'Personnel', amount: '$150,000' },
        { category: 'Equipment', amount: '$100,000' },
      ],
      restrictions: ['No indirect costs'],
      contacts: [
        { name: 'Jane Doe', role: 'Program Officer', email: 'jane@example.org' },
      ],
    },
    confidence: 'high' as const,
    sourceDocumentRef: 'doc-award-001',
  };

  it('accepts valid extract with amount (quality gate via amount)', () => {
    expect(ExtractArtifactSchema.safeParse(validExtract).success).toBe(true);
  });

  it('accepts extract with errors but no amount (quality gate)', () => {
    const data = {
      ...validExtract,
      extracted: { ...validExtract.extracted, amount: '' },
      errors: ['OCR failed on page 3'],
    };
    expect(ExtractArtifactSchema.safeParse(data).success).toBe(true);
  });

  it('rejects extract with no amount and no errors (quality gate)', () => {
    const data = {
      ...validExtract,
      extracted: { ...validExtract.extracted, amount: '' },
    };
    const result = ExtractArtifactSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence value', () => {
    const data = { ...validExtract, confidence: 'unknown' };
    expect(ExtractArtifactSchema.safeParse(data).success).toBe(false);
  });

  it('accepts extract with minimal valid data', () => {
    const data = {
      ...validExtract,
      extracted: {
        amount: '$100,000',
      },
    };
    expect(ExtractArtifactSchema.safeParse(data).success).toBe(true);
  });
});

// =============================
// Additional schemas
// =============================

describe('PeerDiscoveryArtifactSchema', () => {
  it('accepts valid peer discovery', () => {
    const data = {
      artifactType: 'peer-discovery' as const,
      jobId: 'job-004',
      timestamp: '2026-01-15T15:00:00Z',
      results: [
        {
          funderName: 'Knight Foundation',
          funderType: 'foundation' as const,
          relevanceRationale: 'Strong alignment with maker spaces',
          sourceOrganization: 'Noisebridge',
          confidence: 0.85,
        },
      ],
      organizationsAnalyzed: 5,
    };
    expect(PeerDiscoveryArtifactSchema.safeParse(data).success).toBe(true);
  });
});

describe('FunderInsightArtifactSchema', () => {
  it('accepts valid funder insights', () => {
    const data = {
      artifactType: 'funder-insights' as const,
      jobId: 'job-005',
      funderId: 'funder-001',
      timestamp: '2026-01-15T16:00:00Z',
      patterns: [
        {
          patternType: 'giving-trend' as const,
          description: 'Increasing focus on community-led projects',
          confidence: 'high' as const,
          suggestedAction: 'Emphasize community leadership in proposal',
        },
      ],
      givingTrends: [
        { year: 2025, totalGiving: 5000000, grantsCount: 50, averageGrantSize: 100000 },
      ],
    };
    expect(FunderInsightArtifactSchema.safeParse(data).success).toBe(true);
  });
});

describe('EligibilityVettingArtifactSchema', () => {
  it('accepts valid eligibility vetting', () => {
    const data = {
      artifactType: 'eligibility-vetting' as const,
      jobId: 'job-006',
      grantId: 'grant-001',
      timestamp: '2026-01-15T17:00:00Z',
      status: 'meets-all' as const,
      missingRequirements: [],
      recommendation: 'Eligible to apply',
      checks: [
        { requirement: 'Must be 501(c)(3)', met: true, detail: 'IRS letter on file' },
        { requirement: 'Must operate in California', met: true, detail: 'Based in Mountain View' },
      ],
    };
    expect(EligibilityVettingArtifactSchema.safeParse(data).success).toBe(true);
  });
});

describe('BudgetImportArtifactSchema', () => {
  it('accepts valid budget import', () => {
    const data = {
      artifactType: 'budget-import' as const,
      jobId: 'job-007',
      awardId: 'award-001',
      timestamp: '2026-01-15T18:00:00Z',
      categories: [
        { category: 'Personnel', amount: '$150,000', restrictions: 'FTE only' },
        { category: 'Equipment', amount: '$100,000' },
      ],
      totalBudget: '$250,000',
    };
    expect(BudgetImportArtifactSchema.safeParse(data).success).toBe(true);
  });
});
