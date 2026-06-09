/**
 * Shared Bootstrap Templates
 *
 * Minimal default values used to initialize the grant operations system.
 * These are schema-driven templates for SQLite initialization only.
 * No grant data, notification data, or task data is seeded.
 *
 * GAP-05: Eliminates fake/seed data from production paths.
 */

import type { FitRubric, OpencodeSettings } from './types';

// Import the hardcoded Hacker Dojo profile as the default organization profile.
// This is the authoritative org profile — no user configuration needed.
export { HARDCODED_PROFILE as defaultProfile } from '../frontend/src/server/grant-ops/hardcoded-profile';

/**
 * Bootstrap template for Opencode settings.
 * Used when no settings have been saved yet.
 */
export const defaultOpencodeSettings: OpencodeSettings = {
  binaryPath: '',
  workingDirectory: '',
  timeoutMs: 60000,
  isConfigured: false,
};

/**
 * Default empty fit-rubric skeleton. Useful when a brand-new grant is created
 * before any LLM scoring has run — the drawer then renders an empty state
 * instead of a partial 5-dimension view.
 */
export const emptyFitRubric: FitRubric = {
  missionAlignment: { score: 0, justification: '' },
  geographicFocus: { score: 0, justification: '' },
  programTrackrecord: { score: 0, justification: '' },
  budgetCapacity: { score: 0, justification: '' },
  partnershipReadiness: { score: 0, justification: '' },
  overallRationale: '',
  rubricVersion: 1,
};

/**
 * Sample non-empty fit-rubric used by manual smoke tests and the e2e
 * grant-rubric-and-archive spec to seed a grant with a real rubric.
 * NOT written to the database by seed-bootstrap (GAP-05); only used when
 * the test-only seed-rubric endpoint or a fixture builder copies it in.
 */
export const sampleFitRubric: FitRubric = {
  missionAlignment: { score: 0.9, justification: 'Strong mission alignment with maker education.' },
  geographicFocus: { score: 0.8, justification: 'Bay Area presence matches funder scope.' },
  programTrackrecord: { score: 0.85, justification: 'Five years of program outcomes on file.' },
  budgetCapacity: { score: 0.7, justification: 'Match request is 5% of org annual budget.' },
  partnershipReadiness: { score: 0.75, justification: 'Active partner pipeline with two co-applicants.' },
  overallRationale: 'A strong match: high mission alignment, geographic fit, and proven track record.',
  rubricVersion: 1,
};

