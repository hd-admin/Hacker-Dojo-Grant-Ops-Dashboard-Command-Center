/**
 * Prompt Templates
 *
 * Each job type has its own template function that produces a prompt
 * matching the structure required by AC-15.6.1.
 *
 * Prompts are tested for no placeholder text (AC-15.7.1).
 */

import type { AgentTaskType } from '../../../../shared/types';
import { HARDCODED_PROFILE } from './hardcoded-profile';

function getOrgContext(): string {
  const p = HARDCODED_PROFILE;
  return `## Organization Profile\n
Legal Name: ${p.legalName}
EIN: ${p.ein}
Nonprofit Status: ${p.nonprofitStatus}
Geography: ${p.geography}
Mission: ${p.mission}
Program Areas:\n${p.programAreas.map(a => `  - ${a}`).join('\n')}
Populations Served:\n${p.populationsServed.map(p => `  - ${p}`).join('\n')}
Partnerships:\n${p.partnerships.map(p => `  - ${p}`).join('\n')}
Search Themes:\n${p.searchThemes.map(t => `  - ${t}`).join('\n')}
Voice and Tone: ${p.agentBehavior.voiceAndTone}`;
}

function buildPromptHeader(
  type: string,
  artifactPath: string,
  schema: string,
  extraContext: string,
  qualityRequirements: string,
  retryFeedback?: string,
): string {
  const parts = [
    `# Task: ${type}`,
    '',
    '## Context',
    getOrgContext(),
    extraContext,
    '',
    '## Instructions',
    '1. Read and understand the task and context carefully.',
    '2. Complete the task using your knowledge and analysis.',
    '3. Write the output as a single JSON file to the exact path specified below.',
    '4. Every required field must be present. Use empty strings or empty arrays for unknown values.',
    '',
    '## Output Requirement — CRITICAL',
    `You MUST write a single JSON file to: ${artifactPath}`,
    '',
    'The JSON must match this schema exactly:',
    '```json',
    schema,
    '```',
    '',
    '## Rules',
    '1. Write ONLY valid, parseable JSON. No markdown, no code fences, no explanatory text in the file.',
    '2. Every field in the schema must be present (unless marked optional).',
    '3. If you cannot complete the task, include an "errors" array explaining why.',
    '4. Use double quotes for all strings. No trailing commas.',
    '5. Do NOT write anything else to this file — only the JSON object.',
    '',
    '## Quality Requirements',
    qualityRequirements,
  ];

  if (retryFeedback) {
    parts.push('');
    parts.push('## Previous Attempt Failed');
    parts.push(retryFeedback);
    parts.push('Please fix these issues in your new output.');
  }

  return parts.join('\n');
}

export function buildPrompt(
  type: AgentTaskType,
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  switch (type) {
    case 'research':
      return buildResearchPrompt(params, artifactPath, retryFeedback);
    case 'draft':
      return buildDraftPrompt(params, artifactPath, retryFeedback);
    case 'crawl':
      return buildCrawlPrompt(params, artifactPath, retryFeedback);
    case 'match':
      return buildMatchPrompt(params, artifactPath, retryFeedback);
    case 'extract':
      return buildExtractPrompt(params, artifactPath, retryFeedback);
    case 'peer-discovery':
      return buildPeerDiscoveryPrompt(params, artifactPath, retryFeedback);
    case 'funder-insights':
      return buildFunderInsightsPrompt(params, artifactPath, retryFeedback);
    case 'eligibility-vetting':
      return buildEligibilityVettingPrompt(params, artifactPath, retryFeedback);
    case 'budget-import':
      return buildBudgetImportPrompt(params, artifactPath, retryFeedback);
  }
}

function buildResearchPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const searchQuery = (params.query as string) || '';
  const sourceUrls = (params.sources as string[]) || [];

  const extraContext = `
## Search Parameters
Query: ${searchQuery || 'Find all available grants relevant to Hacker Dojo'}
Sources: ${sourceUrls.length > 0 ? sourceUrls.join('\n  - ') : 'All configured sources'}

## Task
Search for grant opportunities matching Hacker Dojo's profile. For each grant found, extract:
- Title, funder name, award amount, deadline
- Eligibility requirements, application URL
- Relevant tags and categories

If you cannot find grants or access sources, explain why in the errors array.`;

  const qualityReq = 'Must find at least 1 grant OR include errors explaining why none were found. Grants must have non-empty title and funder. At least one grant should have award, deadline, or eligibility info.';

  return buildPromptHeader('research', artifactPath, RESEARCH_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildDraftPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const grantTitle = (params.grantTitle as string) || 'the grant';
  const funder = (params.funder as string) || 'the funder';
  const requirements = (params.requirements as string[]) || [];
  const version = (params.version as number) || 1;
  const revisionNotes = (params.revisionNotes as string) || '';

  const extraContext = `
## Grant Details
Title: ${grantTitle}
Funder: ${funder}
Requirements:\n${requirements.map((r: string) => `  - ${r}`).join('\n')}
Version: ${version}
${revisionNotes ? `Revision Notes: ${revisionNotes}` : ''}

## Task
Generate a complete grant proposal draft for this opportunity. The draft must:
- Address each requirement specifically
- Reference Hacker Dojo's mission, programs, and track record
- Use the organization's voice and tone
- Ground each section in specific Hacker Dojo facts and documents`;

  const qualityReq = 'Must be at least 500 words across all sections. Each section must cite grounding sources. Content must reference Hacker Dojo by name and specific programs (not generic "your organization" language).';

  return buildPromptHeader('draft', artifactPath, DRAFT_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildCrawlPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const sourceUrl = (params.sourceUrl as string) || '';
  const sourceName = (params.sourceName as string) || sourceUrl;

  const extraContext = `
## Source
URL: ${sourceUrl}
Name: ${sourceName}

## Task
Crawl this funding source for grant opportunities matching Hacker Dojo's profile. For each grant found, extract:
- Title, funder name, award amount, deadline
- URL, raw text excerpt
Report any pages that fail to load. If no grants are found, explain in the errors array.`;

  const qualityReq = 'Must report pagesCrawled and grantsFound accurately. At least 1 grant OR errors explaining source issues.';

  return buildPromptHeader('crawl', artifactPath, CRAWL_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildMatchPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const grantIds = (params.grantIds as string[]) || [];
  const grantDescriptions = (params.grantDescriptions as string) || '';

  const extraContext = `
## Grants to Score
${grantDescriptions || `Grant IDs: ${grantIds.join(', ')}`}

## Task
Score each grant against Hacker Dojo's profile using 5 dimensions (0-100 each):
1. missionAlignment — How well does the grant align with Hacker Dojo's mission?
2. geographicFocus — Is the grant available in the Bay Area?
3. programTrackrecord — Does Hacker Dojo have relevant experience?
4. budgetCapacity — Is the award size appropriate for Hacker Dojo?
5. partnershipReadiness — Does Hacker Dojo have the required partnerships?

Provide a rationale for each score referencing specific Hacker Dojo attributes.`;

  const qualityReq = 'Scores must vary between grants — not all identical. Each dimension must have a non-zero score with justification.';

  return buildPromptHeader('match', artifactPath, MATCH_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildExtractPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const documentRef = (params.documentRef as string) || '';
  const grantId = (params.grantId as string) || '';

  const extraContext = `
## Document
Reference: ${documentRef}
Grant ID: ${grantId}

## Task
Extract structured data from the award letter/document:
- Award amount, start date, end date
- Reporting deadlines (type, date, format)
- Budget categories (name, amount)
- Compliance requirements
- Program officer contacts

If data cannot be extracted (scanned image, bad OCR), explain in the errors array.`;

  const qualityReq = 'Must include amount OR explain in errors why it could not be extracted. Include at least one reporting deadline or budget category.';

  return buildPromptHeader('extract', artifactPath, EXTRACT_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildPeerDiscoveryPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const extraContext = `
## Task
Analyze similar makerspaces, hackerspaces, and community innovation hubs to identify funders that support comparable organizations. For each peer organization found, identify:
- Funder name and type who supported them
- Relevance rationale connecting to Hacker Dojo
- Source organization that received funding

Organizations to consider: Noisebridge, NYC Resistor, Artisan's Asylum, Dallas Makerspace, Pumping Station: One, and similar community spaces.`;

  const qualityReq = 'Must find at least 1 relevant funder OR explain in errors why none were found. Each result must cite a specific source organization.';

  return buildPromptHeader('peer-discovery', artifactPath, PEER_DISCOVERY_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildFunderInsightsPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const funderName = (params.funderName as string) || '';
  const funderId = (params.funderId as string) || '';

  const extraContext = `
## Funder
Name: ${funderName}
ID: ${funderId}

## Task
Analyze this funder's giving patterns to detect:
1. Multi-year giving trends (total giving, grants count, average grant size by year)
2. Hidden giving patterns: funders that support makerspaces but don't advertise it
3. Focus shifts: foundations changing priorities
4. New programs: corporate giving without formal RFPs yet

For each pattern detected, provide confidence level and suggested action.`;

  const qualityReq = 'Must detect at least 1 pattern OR explain in errors why analysis was inconclusive. Giving trend data must be year-by-year.';

  return buildPromptHeader('funder-insights', artifactPath, FUNDER_INSIGHTS_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildEligibilityVettingPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const grantRequirements = (params.requirements as string) || '';

  const extraContext = `
## Grant Requirements
${grantRequirements}

## Task
Check Hacker Dojo's eligibility for this grant against the requirements:
1. Nonprofit status verification
2. Geographic eligibility
3. Budget range fit
4. Program area alignment
5. Any specific requirements (years of financials, SAM registration, etc.)

For each check, state whether it is met and provide detail. Classify overall status as meets-all, requires, or ineligible.`;

  const qualityReq = 'Must evaluate all applicable requirements. Each check must have a met boolean and detail explanation.';

  return buildPromptHeader('eligibility-vetting', artifactPath, ELIGIBILITY_VETTING_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

function buildBudgetImportPrompt(
  params: Record<string, unknown>,
  artifactPath: string,
  retryFeedback?: string,
): string {
  const documentRef = (params.documentRef as string) || '';
  const awardId = (params.awardId as string) || '';

  const extraContext = `
## Budget Document
Reference: ${documentRef}
Award ID: ${awardId}

## Task
Extract budget categories and amounts from the uploaded budget document. For each category found:
- Category name
- Budget amount
- Any restrictions or notes

If no categories can be extracted, explain why in the errors array.`;

  const qualityReq = 'Must extract at least 1 budget category OR explain in errors why extraction failed. Each category must have a name and amount.';

  return buildPromptHeader('budget-import', artifactPath, BUDGET_IMPORT_SCHEMA_JSON, extraContext, qualityReq, retryFeedback);
}

const RESEARCH_SCHEMA_JSON = `{
  "artifactType": "research",
  "jobId": "string",
  "timestamp": "string (ISO format)",
  "grants": [
    {
      "title": "string (required, non-empty)",
      "funder": "string (required, non-empty)",
      "funderShort": "string",
      "award": "string (optional)",
      "awardSort": 0,
      "deadline": "string (optional)",
      "deadlineConfidence": "exact | estimated | rolling | unknown",
      "eligibility": "string (optional)",
      "requirements": ["string"],
      "externalUrl": "string (optional)",
      "summary": "string (optional)",
      "tags": ["string"],
      "category": "string (optional)"
    }
  ],
  "evidence": [
    {
      "grantTitle": "string",
      "evidenceType": "fit_score | deadline | award_amount | eligibility | requirements",
      "content": "string",
      "sourceUrl": "string (optional)"
    }
  ],
  "rationale": "string (optional)",
  "sourcesFound": 0,
  "grantsFound": 0,
  "errors": ["string (optional)"]
}`;

const DRAFT_SCHEMA_JSON = `{
  "artifactType": "draft",
  "jobId": "string",
  "grantId": "string",
  "version": 1,
  "timestamp": "string (ISO format)",
  "content": "string (full draft text)",
  "sections": [
    {
      "sectionTitle": "string",
      "content": "string (section text)",
      "groundingSources": ["string (document IDs or URLs)"],
      "isGrounded": true,
      "wordCount": 0
    }
  ],
  "wordCount": 0,
  "groundingDocumentIds": ["string"],
  "groundingSourceUrls": ["string"],
  "notes": "string (optional)",
  "errors": ["string (optional)"]
}`;

const CRAWL_SCHEMA_JSON = `{
  "artifactType": "crawl",
  "runId": "string",
  "sourceId": "string",
  "timestamp": "string (ISO format)",
  "status": "completed | partial | failed",
  "grantsFound": [
    {
      "title": "string",
      "funder": "string",
      "award": "string (optional)",
      "deadline": "string (optional)",
      "url": "string (optional)",
      "rawText": "string (optional)"
    }
  ],
  "errorMessage": "string (optional)",
  "pagesCrawled": 0,
  "pagesFailed": 0
}`;

const MATCH_SCHEMA_JSON = `{
  "artifactType": "match",
  "runId": "string",
  "timestamp": "string (ISO format)",
  "matches": [
    {
      "grantTitle": "string",
      "grantId": "string",
      "fitScore": 0,
      "breakdown": {
        "missionAlignment": 0,
        "geographicFocus": 0,
        "programTrackrecord": 0,
        "budgetCapacity": 0,
        "partnershipReadiness": 0
      },
      "rationale": "string"
    }
  ],
  "totalGrantsEvaluated": 0,
  "grantsAboveThreshold": 0
}`;

const EXTRACT_SCHEMA_JSON = `{
  "artifactType": "extract",
  "jobId": "string",
  "grantId": "string",
  "timestamp": "string (ISO format)",
  "extracted": {
    "amount": "string (optional)",
    "startDate": "string (optional)",
    "endDate": "string (optional)",
    "reportingDeadlines": ["string"],
    "complianceRequirements": ["string"],
    "budgetCategories": [
      {
        "category": "string",
        "amount": "string"
      }
    ],
    "restrictions": ["string"],
    "contacts": [
      {
        "name": "string",
        "role": "string",
        "email": "string (optional)"
      }
    ]
  },
  "confidence": "high | medium | low",
  "sourceDocumentRef": "string",
  "errors": ["string (optional)"]
}`;

const PEER_DISCOVERY_SCHEMA_JSON = `{
  "artifactType": "peer-discovery",
  "jobId": "string",
  "timestamp": "string (ISO format)",
  "results": [
    {
      "funderName": "string",
      "funderType": "foundation | government | corporate | community | other",
      "relevanceRationale": "string",
      "sourceOrganization": "string",
      "confidence": 0.0
    }
  ],
  "organizationsAnalyzed": 0,
  "errors": ["string (optional)"]
}`;

const FUNDER_INSIGHTS_SCHEMA_JSON = `{
  "artifactType": "funder-insights",
  "jobId": "string",
  "funderId": "string",
  "timestamp": "string (ISO format)",
  "patterns": [
    {
      "patternType": "giving-trend | hidden-giving | focus-shift | new-program | other",
      "description": "string",
      "confidence": "high | medium | low",
      "suggestedAction": "string (optional)"
    }
  ],
  "givingTrends": [
    {
      "year": 0,
      "totalGiving": 0,
      "grantsCount": 0,
      "averageGrantSize": 0
    }
  ],
  "errors": ["string (optional)"]
}`;

const ELIGIBILITY_VETTING_SCHEMA_JSON = `{
  "artifactType": "eligibility-vetting",
  "jobId": "string",
  "grantId": "string",
  "timestamp": "string (ISO format)",
  "status": "meets-all | requires | ineligible",
  "missingRequirements": ["string"],
  "recommendation": "string (optional)",
  "checks": [
    {
      "requirement": "string",
      "met": true,
      "detail": "string"
    }
  ],
  "errors": ["string (optional)"]
}`;

const BUDGET_IMPORT_SCHEMA_JSON = `{
  "artifactType": "budget-import",
  "jobId": "string",
  "awardId": "string",
  "timestamp": "string (ISO format)",
  "categories": [
    {
      "category": "string",
      "amount": "string",
      "restrictions": "string (optional)"
    }
  ],
  "totalBudget": "string (optional)",
  "errors": ["string (optional)"]
}`;

export { getOrgContext };
