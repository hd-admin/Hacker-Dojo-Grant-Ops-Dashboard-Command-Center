import { z } from 'zod';

export const ResearchArtifactSchema = z.object({
  artifactType: z.literal('research'),
  jobId: z.string(),
  timestamp: z.string(),
  grants: z.array(
    z.object({
      title: z.string().min(1),
      funder: z.string().min(1),
      funderShort: z.string(),
      award: z.string().optional(),
      awardSort: z.number().optional(),
      deadline: z.string().optional(),
      deadlineConfidence: z.enum(['exact', 'estimated', 'rolling', 'unknown']).optional(),
      eligibility: z.string().optional(),
      requirements: z.array(z.string()).optional(),
      externalUrl: z.string().optional(),
      summary: z.string().optional(),
      tags: z.array(z.string()),
      category: z.string().optional(),
    }),
  ),
  evidence: z.array(
    z.object({
      grantTitle: z.string(),
      evidenceType: z.enum([
        'fit_score',
        'deadline',
        'award_amount',
        'eligibility',
        'requirements',
      ]),
      content: z.string(),
      sourceUrl: z.string().optional(),
    }),
  ),
  rationale: z.string().optional(),
  sourcesFound: z.number().int().min(0),
  grantsFound: z.number().int().min(0),
  errors: z.array(z.string()).optional(),
}).refine(
  (data) => data.grants.length > 0 || (data.errors && data.errors.length > 0),
  { message: 'Research must produce at least one grant or list errors', path: ['grants'] },
);

export const DraftArtifactSchema = z.object({
  artifactType: z.literal('draft'),
  jobId: z.string(),
  grantId: z.string(),
  version: z.number(),
  timestamp: z.string(),
  content: z.string(),
  sections: z.array(
    z.object({
      sectionTitle: z.string(),
      content: z.string(),
      groundingSources: z.array(z.string()),
      isGrounded: z.boolean(),
      wordCount: z.number().optional(),
    }),
  ),
  wordCount: z.number(),
  groundingDocumentIds: z.array(z.string()),
  groundingSourceUrls: z.array(z.string()),
  notes: z.string().optional(),
  errors: z.array(z.string()).optional(),
}).refine(
  (data) => data.wordCount >= 500,
  { message: 'Draft must contain at least 500 words', path: ['wordCount'] },
).refine(
  (data) => data.sections.some((s) => s.isGrounded),
  { message: 'Draft must have at least one grounded section', path: ['sections'] },
);

export const CrawlArtifactSchema = z.object({
  artifactType: z.literal('crawl'),
  runId: z.string(),
  sourceId: z.string(),
  timestamp: z.string(),
  status: z.enum(['completed', 'partial', 'failed']),
  grantsFound: z.array(
    z.object({
      title: z.string(),
      funder: z.string(),
      award: z.string().optional(),
      deadline: z.string().optional(),
      url: z.string().optional(),
      rawText: z.string().optional(),
    }),
  ),
  errorMessage: z.string().optional(),
  pagesCrawled: z.number().int().min(0),
  pagesFailed: z.number().int().min(0),
});

export const MatchArtifactSchema = z.object({
  artifactType: z.literal('match'),
  runId: z.string(),
  timestamp: z.string(),
  matches: z.array(
    z.object({
      grantTitle: z.string(),
      grantId: z.string(),
      fitScore: z.number().min(0).max(100),
      breakdown: z.object({
        missionAlignment: z.number().min(0).max(100),
        geographicFocus: z.number().min(0).max(100),
        programTrackrecord: z.number().min(0).max(100),
        budgetCapacity: z.number().min(0).max(100),
        partnershipReadiness: z.number().min(0).max(100),
      }),
      rationale: z.string(),
    }),
  ),
  totalGrantsEvaluated: z.number().int().min(0),
  grantsAboveThreshold: z.number().int().min(0),
}).refine(
  (data) => {
    if (data.matches.length <= 1) return true;
    const scores = data.matches.map((m) => m.fitScore);
    return new Set(scores).size === scores.length || scores.length === 1;
  },
  { message: 'Match scores should not all be identical when multiple matches exist', path: ['matches'] },
);

export const ExtractArtifactSchema = z.object({
  artifactType: z.literal('extract'),
  jobId: z.string(),
  grantId: z.string(),
  timestamp: z.string(),
  extracted: z.object({
    amount: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reportingDeadlines: z.array(z.string()).optional(),
    complianceRequirements: z.array(z.string()).optional(),
    budgetCategories: z
      .array(
        z.object({
          category: z.string(),
          amount: z.string(),
        }),
      )
      .optional(),
    restrictions: z.array(z.string()).optional(),
    contacts: z
      .array(
        z.object({
          name: z.string(),
          role: z.string(),
          email: z.string().optional(),
        }),
      )
      .optional(),
  }),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceDocumentRef: z.string(),
  errors: z.array(z.string()).optional(),
}).refine(
  (data) =>
    (data.extracted.amount && data.extracted.amount.length > 0) ||
    (data.errors && data.errors.length > 0),
  { message: 'Extract must have a non-empty amount or an errors explanation', path: ['extracted', 'amount'] },
);

export const PeerDiscoveryArtifactSchema = z.object({
  artifactType: z.literal('peer-discovery'),
  jobId: z.string(),
  timestamp: z.string(),
  results: z.array(
    z.object({
      funderName: z.string(),
      funderType: z.enum(['foundation', 'government', 'corporate', 'community', 'other']),
      relevanceRationale: z.string(),
      sourceOrganization: z.string(),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
  organizationsAnalyzed: z.number().int().min(0),
  errors: z.array(z.string()).optional(),
});

export const FunderInsightArtifactSchema = z.object({
  artifactType: z.literal('funder-insights'),
  jobId: z.string(),
  funderId: z.string(),
  timestamp: z.string(),
  patterns: z.array(
    z.object({
      patternType: z.enum([
        'giving-trend',
        'hidden-giving',
        'focus-shift',
        'new-program',
        'other',
      ]),
      description: z.string(),
      confidence: z.enum(['high', 'medium', 'low']),
      suggestedAction: z.string().optional(),
    }),
  ),
  givingTrends: z
    .array(
      z.object({
        year: z.number(),
        totalGiving: z.number(),
        grantsCount: z.number(),
        averageGrantSize: z.number(),
      }),
    )
    .optional(),
  errors: z.array(z.string()).optional(),
});

export const EligibilityVettingArtifactSchema = z.object({
  artifactType: z.literal('eligibility-vetting'),
  jobId: z.string(),
  grantId: z.string(),
  timestamp: z.string(),
  status: z.enum(['meets-all', 'requires', 'ineligible']),
  missingRequirements: z.array(z.string()),
  recommendation: z.string().optional(),
  checks: z.array(
    z.object({
      requirement: z.string(),
      met: z.boolean(),
      detail: z.string(),
    }),
  ),
  errors: z.array(z.string()).optional(),
});

export const BudgetImportArtifactSchema = z.object({
  artifactType: z.literal('budget-import'),
  jobId: z.string(),
  awardId: z.string(),
  timestamp: z.string(),
  categories: z.array(
    z.object({
      category: z.string(),
      amount: z.string(),
      restrictions: z.string().optional(),
    }),
  ),
  totalBudget: z.string().optional(),
  errors: z.array(z.string()).optional(),
});

export type ResearchArtifact = z.infer<typeof ResearchArtifactSchema>;
export type DraftArtifactV2 = z.infer<typeof DraftArtifactSchema>;
export type CrawlArtifact = z.infer<typeof CrawlArtifactSchema>;
export type MatchArtifact = z.infer<typeof MatchArtifactSchema>;
export type ExtractArtifact = z.infer<typeof ExtractArtifactSchema>;
export type PeerDiscoveryArtifact = z.infer<typeof PeerDiscoveryArtifactSchema>;
export type FunderInsightArtifact = z.infer<typeof FunderInsightArtifactSchema>;
export type EligibilityVettingArtifact = z.infer<typeof EligibilityVettingArtifactSchema>;
export type BudgetImportArtifact = z.infer<typeof BudgetImportArtifactSchema>;
