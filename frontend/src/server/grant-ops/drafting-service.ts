/**
 * Drafting Service
 *
 * Handles proposal draft generation and revision management.
 */

import type {
  DraftArtifact,
  Grant,
  RevisionRequest,
  OrganizationProfile,
} from '../../../../shared/types';
import { getOpencodeAdapter } from './opencode-client';
import * as repository from './repository';

export interface GenerateDraftOptions {
  useOpencode?: boolean;
  opencodeProvider?: 'cli' | 'fake';
  revisionNotes?: string;
}

export async function generateDraft(
  grant: Grant,
  profile: OrganizationProfile,
  options: GenerateDraftOptions = {},
): Promise<DraftArtifact> {
  // Get existing drafts to determine version number
  const existingDrafts = await repository.getDraftArtifacts(grant.id);
  const latestVersion = existingDrafts.length > 0
    ? Math.max(...existingDrafts.map((d) => d.version))
    : 0;

  const settings = await repository.getOpencodeSettings();
  const adapter = getOpencodeAdapter(
    settings || {
      binaryPath: '',
      workingDirectory: '',
      timeoutMs: 60000,
      isConfigured: false,
    },
    options.opencodeProvider || (settings?.isConfigured ? 'cli' : 'fake'),
  );

  // Get previous draft if exists
  const previousDraft = await repository.getLatestDraftArtifact(grant.id);
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

  let draftContent: string;

  if (response.success && response.content) {
    draftContent = response.content;
  } else {
    // Fallback draft content if Opencode fails
    draftContent = generateFallbackDraft(grant, profile, options.revisionNotes);
  }

  // Create draft artifact
  const draftArtifact: DraftArtifact = {
    id: `draft-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
    grantId: grant.id,
    version: latestVersion + 1,
    content: draftContent,
    createdAt: new Date().toISOString(),
    createdBy: 'agent',
    revisionNotes: options.revisionNotes || '',
  };

  await repository.addDraftArtifact(draftArtifact);

  // Update grant status to drafting
  await repository.updateGrant(grant.id, {
    status: 'draft',
    statusLabel: 'Drafting',
    draftContent,
  });

  return draftArtifact;
}

export async function createRevisionRequest(
  grant: Grant,
  notes: string,
  requestedBy: string,
): Promise<RevisionRequest> {
  // Get latest draft version
  const drafts = await repository.getDraftArtifacts(grant.id);
  const latestVersion = drafts.length > 0
    ? Math.max(...drafts.map((d) => d.version))
    : 0;

  const revisionRequest: RevisionRequest = {
    id: `revision-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
    grantId: grant.id,
    draftVersion: latestVersion,
    notes,
    requestedAt: new Date().toISOString(),
    requestedBy,
    status: 'pending',
  };

  await repository.addRevisionRequest(revisionRequest);

  // Update grant status - revision_requested keeps it in drafting state
  await repository.updateGrant(grant.id, {
    status: 'draft',
    statusLabel: 'Drafting',
  });

  return revisionRequest;
}

export async function getDraftArtifacts(grantId: string): Promise<DraftArtifact[]> {
  return repository.getDraftArtifacts(grantId);
}

export async function getRevisionRequests(grantId: string): Promise<RevisionRequest[]> {
  return repository.getRevisionRequests(grantId);
}

function generateFallbackDraft(
  grant: Grant,
  profile: OrganizationProfile,
  revisionNotes?: string,
): string {
  let draft = `## ${grant.title}

### Executive Summary

${profile.legalName} is seeking funding to support our mission of ${profile.mission}.

### Organizational Background

${profile.legalName} has been serving the community since our founding. Our programs focus on delivering impactful services to our target populations.

### Program Description

This proposal outlines a comprehensive approach to addressing community needs through innovative programs.

### Budget

Award Amount: ${grant.award}
Proposed Use: [To be detailed based on grant requirements]

### Conclusion

We believe this partnership will create lasting positive impact.
`;

  if (revisionNotes) {
    draft += `\n\n### Revision Notes\n${revisionNotes}\n`;
  }

  return draft;
}
