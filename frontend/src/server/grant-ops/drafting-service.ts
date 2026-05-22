/**
 * Drafting Service
 *
 * Handles proposal draft generation and revision management.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 * Production behavior: when using 'cli' provider, requires configured Opencode settings.
 * When 'fake' provider is explicitly requested, works without Opencode configuration (for testing).
 */

import type {
  DraftArtifact,
  Grant,
  RevisionRequest,
  OrganizationProfile,
} from '../../../../shared/types';
import { getDependencies } from './dependencies';

export interface GenerateDraftOptions {
  revisionNotes?: string;
  /**
   * @internal Test-only option. Do not use in production code.
   */
  _providerType?: 'cli' | 'fake';
}

export async function generateDraft(
  grant: Grant,
  profile: OrganizationProfile,
  options: GenerateDraftOptions = {},
): Promise<DraftArtifact> {
  const deps = getDependencies();
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  // Get existing drafts to determine version number
  const existingDrafts = await deps.repository.getDraftArtifacts(grant.id);
  const latestVersion = existingDrafts.length > 0
    ? Math.max(...existingDrafts.map((d) => d.version))
    : 0;

  const settings = await deps.repository.getOpencodeSettings();
  
  // Determine provider type - use internal _providerType if set (test-only), otherwise require CLI with config
  const providerType = options._providerType || 'cli';

  if (providerType === 'cli') {
    if (!settings?.isConfigured) {
      throw new Error(
        'Opencode is not configured. Please set up Opencode settings in the application before generating drafts.',
      );
    }
  }

  // Create Opencode adapter using DI
  const adapter = deps.createOpencodeAdapter(settings!, providerType);

  // Get previous draft if exists
  const previousDraft = await deps.repository.getLatestDraftArtifact(grant.id);
  const previousContent = previousDraft?.content;

  // Generate new draft
  const response = await adapter.generateDraft({
    grantTitle: grant.title,
    grantFunder: grant.funder,
    grantAmount: grant.award,
    grantDeadline: grant.deadline,
    organizationProfile: `${profile.legalName}\n\nEIN: ${profile.ein}\nSAM UEI: ${profile.samUEI}`,
    missionStatement: profile.mission,
    previousDraft: previousContent || '',
    revisionNotes: options.revisionNotes || '',
  });

  if (!response.success || !response.content) {
    throw new Error(
      `Draft generation failed: ${response.error || 'Unknown error from Opencode'}`,
    );
  }

  // Create draft artifact
  const draftArtifact: DraftArtifact = {
    id: idGenerator.generateId('draft'),
    grantId: grant.id,
    version: latestVersion + 1,
    content: response.content,
    createdAt: clock.now().toISOString(),
    createdBy: 'agent',
    revisionNotes: options.revisionNotes || '',
  };

  await deps.repository.addDraftArtifact(draftArtifact);

  // Update grant status to drafting
  await deps.repository.updateGrant(grant.id, {
    status: 'draft',
    statusLabel: 'Drafting',
    draftContent: response.content,
  });

  return draftArtifact;
}

export async function createRevisionRequest(
  grant: Grant,
  notes: string,
  requestedBy: string,
): Promise<RevisionRequest> {
  const deps = getDependencies();
  const idGenerator = deps.idGenerator;

  // Get latest draft version
  const drafts = await deps.repository.getDraftArtifacts(grant.id);
  const latestVersion = drafts.length > 0
    ? Math.max(...drafts.map((d) => d.version))
    : 0;

  const revisionRequest: RevisionRequest = {
    id: idGenerator.generateId('revision'),
    grantId: grant.id,
    draftVersion: latestVersion,
    notes,
    requestedAt: new Date().toISOString(),
    requestedBy,
    status: 'pending',
  };

  await deps.repository.addRevisionRequest(revisionRequest);

  // Update grant status - revision_requested keeps it in drafting state
  await deps.repository.updateGrant(grant.id, {
    status: 'draft',
    statusLabel: 'Drafting',
  });

  return revisionRequest;
}

export async function getDraftArtifacts(grantId: string): Promise<DraftArtifact[]> {
  const deps = getDependencies();
  return deps.repository.getDraftArtifacts(grantId);
}

export async function getRevisionRequests(grantId: string): Promise<RevisionRequest[]> {
  const deps = getDependencies();
  return deps.repository.getRevisionRequests(grantId);
}
