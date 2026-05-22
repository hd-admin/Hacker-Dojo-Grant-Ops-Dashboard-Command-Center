/**
 * Repository Layer
 *
 * Provides a clean interface for persisting and retrieving grant operations data.
 * Uses the shared grant-ops-persistence.ts functions for data storage.
 */

import type {
  Grant,
  Source,
  CrawlRun,
  DraftArtifact,
  RevisionRequest,
  ApprovalRecord,
  SubmissionRecord,
  FollowUp,
  OpencodeSettings,
  OrganizationProfile,
  Notification,
  Task,
} from '../../../../shared/types';

// Import from shared persistence layer (GAP-01 fix)
import {
  loadPersistedData,
  savePersistedData,
  loadGrants,
  saveGrants,
  loadProfile,
  saveProfile,
  loadNotifications,
  saveNotifications,
  loadTasks,
  saveTasks,
  loadDocuments,
  saveDocuments,
} from '../../../../shared/grant-ops-persistence';

import type { DocumentMetadata } from '../../../../shared/types';

// Source operations
export async function getSources(): Promise<Source[]> {
  const data = await loadPersistedData();
  return data.sources;
}

export async function addSource(source: Source): Promise<void> {
  const data = await loadPersistedData();
  data.sources.push(source);
  await savePersistedData(data);
}

export async function removeSource(id: string): Promise<void> {
  const data = await loadPersistedData();
  data.sources = data.sources.filter((s: Source) => s.id !== id);
  await savePersistedData(data);
}

// CrawlRun operations
export async function getCrawlRuns(): Promise<CrawlRun[]> {
  const data = await loadPersistedData();
  return data.crawlRuns;
}

export async function getLatestCrawlRun(): Promise<CrawlRun | null> {
  const runs = await getCrawlRuns();
  if (runs.length === 0) return null;
  return runs[runs.length - 1] ?? null;
}

export async function addCrawlRun(run: CrawlRun): Promise<void> {
  const data = await loadPersistedData();
  data.crawlRuns.push(run);
  await savePersistedData(data);
}

export async function updateCrawlRun(run: CrawlRun): Promise<void> {
  const data = await loadPersistedData();
  const index = data.crawlRuns.findIndex((r: CrawlRun) => r.id === run.id);
  if (index !== -1) {
    data.crawlRuns[index] = run;
    await savePersistedData(data);
  }
}

// DraftArtifact operations
export async function getDraftArtifacts(grantId: string): Promise<DraftArtifact[]> {
  const data = await loadPersistedData();
  return data.draftArtifacts.filter((d: DraftArtifact) => d.grantId === grantId);
}

export async function getLatestDraftArtifact(grantId: string): Promise<DraftArtifact | null> {
  const drafts = await getDraftArtifacts(grantId);
  if (drafts.length === 0) return null;
  return drafts.sort((a, b) => b.version - a.version)[0] ?? null;
}

export async function addDraftArtifact(artifact: DraftArtifact): Promise<void> {
  const data = await loadPersistedData();
  data.draftArtifacts.push(artifact);
  await savePersistedData(data);
}

// RevisionRequest operations
export async function getRevisionRequests(grantId: string): Promise<RevisionRequest[]> {
  const data = await loadPersistedData();
  return data.revisionRequests.filter((r: RevisionRequest) => r.grantId === grantId);
}

export async function addRevisionRequest(request: RevisionRequest): Promise<void> {
  const data = await loadPersistedData();
  data.revisionRequests.push(request);
  await savePersistedData(data);
}

// ApprovalRecord operations
export async function getApprovalRecord(grantId: string): Promise<ApprovalRecord | null> {
  const data = await loadPersistedData();
  return data.approvalRecords.find((r: ApprovalRecord) => r.grantId === grantId) || null;
}

export async function addApprovalRecord(record: ApprovalRecord): Promise<void> {
  const data = await loadPersistedData();
  // Remove any existing approval for this grant
  data.approvalRecords = data.approvalRecords.filter((r) => r.grantId !== record.grantId);
  data.approvalRecords.push(record);
  await savePersistedData(data);
}

// SubmissionRecord operations
export async function getSubmissionRecord(grantId: string): Promise<SubmissionRecord | null> {
  const data = await loadPersistedData();
  return data.submissionRecords.find((r: SubmissionRecord) => r.grantId === grantId) || null;
}

export async function addSubmissionRecord(record: SubmissionRecord): Promise<void> {
  const data = await loadPersistedData();
  data.submissionRecords.push(record);
  await savePersistedData(data);
}

// FollowUp operations
export async function getFollowUps(): Promise<FollowUp[]> {
  const data = await loadPersistedData();
  return data.followUps;
}

export async function addFollowUp(followUp: FollowUp): Promise<void> {
  const data = await loadPersistedData();
  data.followUps.push(followUp);
  await savePersistedData(data);
}

export async function updateFollowUp(followUp: FollowUp): Promise<void> {
  const data = await loadPersistedData();
  const index = data.followUps.findIndex((f: FollowUp) => f.id === followUp.id);
  if (index !== -1) {
    data.followUps[index] = followUp;
    await savePersistedData(data);
  }
}

// OpencodeSettings operations
export async function getOpencodeSettings(): Promise<OpencodeSettings | null> {
  const data = await loadPersistedData();
  return data.opencodeSettings;
}

export async function updateOpencodeSettings(settings: OpencodeSettings): Promise<void> {
  const data = await loadPersistedData();
  data.opencodeSettings = settings;
  await savePersistedData(data);
}

// Notification operations
export async function getNotifications(): Promise<Notification[]> {
  return loadNotifications();
}

export async function updateNotifications(notifications: Notification[]): Promise<void> {
  await saveNotifications(notifications);
}

// Task operations
export async function getTasks(): Promise<Task[]> {
  return loadTasks();
}

export async function updateTasks(tasks: Task[]): Promise<void> {
  await saveTasks(tasks);
}

// Document operations
export async function getDocuments(): Promise<DocumentMetadata[]> {
  return loadDocuments();
}

export async function addDocument(doc: DocumentMetadata): Promise<void> {
  const docs = await loadDocuments();
  docs.push(doc);
  await saveDocuments(docs);
}

export async function updateDocument(id: string, updates: Partial<DocumentMetadata>): Promise<void> {
  const docs = await loadDocuments();
  const index = docs.findIndex((d: DocumentMetadata) => d.id === id);
  if (index !== -1) {
    const existing = docs[index];
    if (existing) {
      // Apply only the properties that were explicitly provided in updates
      const { id: _id, ...rest } = updates;
      Object.assign(existing, rest);
      await saveDocuments(docs);
    }
  }
}

// Grants operations - now uses shared persistence (GAP-01 fix)
export async function getGrants(): Promise<Grant[]> {
  return loadGrants();
}

export async function saveGrantsToRepo(grants: Grant[]): Promise<void> {
  await saveGrants(grants);
}

export async function getGrant(id: string): Promise<Grant | null> {
  const grants = await loadGrants();
  return grants.find((g: Grant) => g.id === id) || null;
}

export async function updateGrant(id: string, updates: Partial<Grant>): Promise<void> {
  const grants = await loadGrants();
  const index = grants.findIndex((g: Grant) => g.id === id);
  if (index !== -1) {
    const existing = grants[index]!;
    grants[index] = { ...existing, ...updates } as Grant;
    await saveGrants(grants);
  }
}

export async function addGrant(grant: Grant): Promise<void> {
  const grants = await loadGrants();
  grants.push(grant);
  await saveGrants(grants);
}

// Organization profile operations - now uses shared persistence (GAP-01 fix)
export async function getOrgProfile(): Promise<OrganizationProfile | null> {
  return loadProfile();
}

export async function updateOrgProfile(profile: OrganizationProfile): Promise<void> {
  await saveProfile(profile);
}
