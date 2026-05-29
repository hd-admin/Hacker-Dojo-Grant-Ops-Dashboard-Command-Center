/**
 * Profile Service
 *
 * Manages organization profile CRUD, missing-field detection,
 * submission-readiness blocking, restricted-document enforcement,
 * and document freshness tracking.
 *
 * Follows DI pattern via getDependencies().
 */

import type {
  OrganizationProfile,
  DocumentMetadata,
} from '../../../../shared/types';
import { getDependencies } from './dependencies';

/**
 * Required fields for submission readiness.
 * These must be non-empty for a grant submission to proceed.
 */
const REQUIRED_PROFILE_FIELDS = [
  'legalName',
  'ein',
  'samUEI',
  'nonprofitStatus',
  'contactInfo.address',
  'contactInfo.email',
  'geography',
  'mission',
  'programAreas',
  'populationsServed',
  'agentBehavior.notifyEmail',
] as const;

const DOCUMENT_STALENESS_DAYS = 90;

/**
 * Patterns that identify restricted documents that should not be shared externally.
 */
const RESTRICTED_PATTERNS = [
  /tax[-_]?return/i,
  /bank[-_]?statement/i,
  /internal[-_]?audit/i,
  /salary/i,
  /payroll/i,
  /confidential/i,
  /personnel/i,
] as const;

// --- Public API ---

/**
 * Get the current organization profile.
 * Returns default profile if none exists.
 */
export async function getProfile(): Promise<OrganizationProfile> {
  const deps = getDependencies();
  const profile = await deps.repository.getOrgProfile();
  if (!profile) throw new Error('Organization profile not initialized');
  return profile;
}

/**
 * Update the organization profile.
 * Replaces the entire profile with the provided data.
 */
export async function updateProfile(
  profile: OrganizationProfile,
): Promise<void> {
  const deps = getDependencies();
  await deps.repository.updateOrgProfile(profile);
}

/**
 * Get list of required fields that are missing/empty.
 * Used to flag incomplete profile data.
 */
export function getMissingRequiredFields(
  profile: OrganizationProfile,
): string[] {
  const missing: string[] = [];

  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = getNestedValue(profile as unknown as Record<string, unknown>, field);
    if (isEmpty(value)) {
      missing.push(field);
    }
  }

  return missing;
}

/**
 * Check if the profile is ready for grant submission.
 * Returns a structured result with readiness status, missing fields, and blocking reason.
 */
export async function isSubmissionReady(
  profile: OrganizationProfile,
): Promise<{
  ready: boolean;
  missingFields: string[];
  blockingReason: string | null;
}> {
  const missingFields = getMissingRequiredFields(profile);

  if (missingFields.length > 0) {
    return {
      ready: false,
      missingFields,
      blockingReason: `Organization profile is incomplete. Missing required fields: ${missingFields.join(', ')}`,
    };
  }

  return {
    ready: true,
    missingFields: [],
    blockingReason: null,
  };
}

/**
 * Flag documents that match restricted patterns.
 * These documents contain sensitive information and should not be shared.
 */
export function enforceRestrictedDocuments(
  documents: DocumentMetadata[],
): DocumentMetadata[] {
  return documents.filter((doc) => {
    const name = doc.name.toLowerCase();
    return RESTRICTED_PATTERNS.some((pattern) => pattern.test(name));
  });
}

/**
 * Check document freshness and staleness.
 * Returns a structured assessment of document health.
 */
export function getDocumentFreshness(
  documents: DocumentMetadata[],
): {
  isStale: boolean;
  staleCount: number;
  unauditedCount: number;
  staleDocuments: DocumentMetadata[];
  lastUpdated: string | null;
} {
  const now = new Date();
  const staleThreshold = new Date(
    now.getTime() - DOCUMENT_STALENESS_DAYS * 24 * 60 * 60 * 1000,
  );

  const staleDocuments: DocumentMetadata[] = [];
  let unauditedCount = 0;
  let lastUpdated: string | null = null;

  for (const doc of documents) {
    // Track unaudited
    if (!doc.audited) {
      unauditedCount++;
    }

    // Check freshness
    if (!doc.lastUsed) {
      staleDocuments.push(doc);
      continue;
    }

    const lastUsed = new Date(doc.lastUsed);
    if (lastUsed < staleThreshold) {
      staleDocuments.push(doc);
    }

    // Track most recent update
    if (!lastUpdated || doc.lastUsed > lastUpdated) {
      lastUpdated = doc.lastUsed;
    }
  }

  return {
    isStale: staleDocuments.length > 0,
    staleCount: staleDocuments.length,
    unauditedCount,
    staleDocuments,
    lastUpdated,
  };
}

// --- Helpers ---

function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
