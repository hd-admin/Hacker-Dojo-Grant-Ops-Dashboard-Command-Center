/**
 * Repository Layer
 *
 * Provides a clean interface for persisting and retrieving grant operations data.
 * Uses the shared grant-ops-persistence.ts functions for data storage.
 */

import 'server-only';
import type {
  ApprovalRecord,
  AuditEvent,
  ConflictRecord,
  CrawlRun,
  DraftArtifact,
  DuplicateCandidate,
  FollowUp,
  Grant,
  JobQueueItem,
  Notification,
  OpencodeSettings,
  OrganizationProfile,
  RevisionRequest,
  Source,
  SubmissionManifest,
  SubmissionRecord,
  Task,
} from '../../../../shared/types';

// Import from shared persistence layer (GAP-01 fix)
import {
  loadAuditEvents as loadAuditEventsPersistence,
  loadConflictRecords as loadConflictRecordsPersistence,
  loadDuplicateCandidates as loadDuplicateCandidatesPersistence,
  loadPersistedData,
  savePersistedData,
  loadGrants,
  saveGrants,
  loadProfile,
  saveProfile,
  loadJobQueue as loadJobQueuePersistence,
  loadJobQueueItem as loadJobQueueItemPersistence,
  loadNotifications,
  saveNotifications,
  loadSubmissionManifests as loadSubmissionManifestsPersistence,
  loadTasks,
  saveTasks,
  loadDocuments,
  saveDocuments,
  loadOpencodeSettings,
  saveOpencodeSettings,
  saveAuditEvent as saveAuditEventPersistence,
  saveConflictRecord as saveConflictRecordPersistence,
  saveDuplicateCandidate as saveDuplicateCandidatePersistence,
  saveJobQueueItem as saveJobQueueItemPersistence,
  saveSubmissionManifest as saveSubmissionManifestPersistence,
  removeApprovalRecordPersistence,
  updateConflictRecordPersistence,
  updateDuplicateCandidatePersistence,
  updateJobQueueItemPersistence,
  loadDraftSnippets,
  saveDraftSnippets,
  loadSavedSearches,
  saveSavedSearches,
  loadFunderProfiles,
  saveFunderProfiles,
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

export async function updateSubmissionRecord(record: SubmissionRecord): Promise<void> {
  const data = await loadPersistedData();
  const index = data.submissionRecords.findIndex((existing: SubmissionRecord) => existing.id === record.id);
  if (index !== -1) {
    data.submissionRecords[index] = record;
    await savePersistedData(data);
  }
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

export async function deleteFollowUp(id: string): Promise<boolean> {
  const data = await loadPersistedData();
  const index = data.followUps.findIndex((f: FollowUp) => f.id === id);
  if (index !== -1) {
    data.followUps.splice(index, 1);
    await savePersistedData(data);
    return true;
  }
  return false;
}

// OpencodeSettings operations - use dedicated singletons to bypass cached aggregate
export async function getOpencodeSettings(): Promise<OpencodeSettings | null> {
  return loadOpencodeSettings();
}

export async function updateOpencodeSettings(settings: OpencodeSettings): Promise<void> {
  await saveOpencodeSettings(settings);
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

// Audit event operations
export async function getAuditEvents(limit?: number): Promise<AuditEvent[]> {
  return loadAuditEventsPersistence(limit);
}

export async function addAuditEvent(event: AuditEvent): Promise<void> {
  await saveAuditEventPersistence(event);
}

// Job queue operations
export async function getJobQueue(status?: string): Promise<JobQueueItem[]> {
  return loadJobQueuePersistence(status);
}

export async function getJobQueueItem(id: string): Promise<JobQueueItem | null> {
  return loadJobQueueItemPersistence(id);
}

export async function addJobQueueItem(item: JobQueueItem): Promise<void> {
  await saveJobQueueItemPersistence(item);
}

export async function updateJobQueueItem(id: string, updates: Partial<JobQueueItem>): Promise<void> {
  await updateJobQueueItemPersistence(id, updates);
}

// Duplicate/conflict operations
export async function getDuplicateCandidates(status?: string): Promise<DuplicateCandidate[]> {
  return loadDuplicateCandidatesPersistence(status);
}

export async function addDuplicateCandidate(item: DuplicateCandidate): Promise<void> {
  await saveDuplicateCandidatePersistence(item);
}

export async function updateDuplicateCandidate(id: string, updates: Partial<DuplicateCandidate>): Promise<void> {
  await updateDuplicateCandidatePersistence(id, updates);
}

export async function getConflictRecords(grantId?: string): Promise<ConflictRecord[]> {
  return loadConflictRecordsPersistence(grantId);
}

export async function addConflictRecord(item: ConflictRecord): Promise<void> {
  await saveConflictRecordPersistence(item);
}

export async function updateConflictRecord(id: string, updates: Partial<ConflictRecord>): Promise<void> {
  await updateConflictRecordPersistence(id, updates);
}

// Submission manifest operations
export async function getSubmissionManifests(grantId?: string): Promise<SubmissionManifest[]> {
  return loadSubmissionManifestsPersistence(grantId);
}

export async function addSubmissionManifest(item: SubmissionManifest): Promise<void> {
  await saveSubmissionManifestPersistence(item);
}

export async function updateSubmissionManifest(id: string, updates: Partial<SubmissionManifest>): Promise<void> {
  const manifests = await getSubmissionManifests();
  const index = manifests.findIndex((manifest) => manifest.id === id);
  if (index !== -1) {
    const existing = manifests[index]!;
    const updated: SubmissionManifest = {
      id: existing.id,
      grantId: existing.grantId,
      version: existing.version,
      createdAt: existing.createdAt,
      updatedAt: updates.updatedAt ?? existing.updatedAt,
      materialRefs: updates.materialRefs ?? existing.materialRefs,
    };
    if (updates.instructions !== undefined) updated.instructions = updates.instructions;
    if (updates.portalUrl !== undefined) updated.portalUrl = updates.portalUrl;
    if (updates.fileConstraints !== undefined) updated.fileConstraints = updates.fileConstraints;
    if (updates.dueDate !== undefined) updated.dueDate = updates.dueDate;
    if (updates.notes !== undefined) updated.notes = updates.notes;
    await addSubmissionManifest(updated);
  }
}

export async function removeApprovalRecord(grantId: string): Promise<void> {
  await removeApprovalRecordPersistence(grantId);
}

export async function updateSource(id: string, updates: Partial<Source>): Promise<void> {
  const data = await loadPersistedData();
  const index = data.sources.findIndex((source) => source.id === id);
  if (index === -1) {
    return;
  }
  data.sources[index] = { ...data.sources[index]!, ...updates };
  await savePersistedData(data);
}

// ============ NEW V2 ENTITY METHODS (typed columns) ============

import type {
  Award,
  AwardBudgetCategory,
  AwardExpense,
  AwardReportDeadline,
  AwardComplianceItem,
  DraftSnippet,
  SavedSearch,
  FunderProfile,
  PipelineTransition,
} from '../../../../shared/types';
import {
  loadAwardBudgetCategories,
  loadAwardExpenses,
  loadAwardReportDeadlines,
  loadAwardComplianceItems,
  loadOutreachRecords,
  saveOutreachRecord,
  loadFormTemplates,
  saveFormTemplate,
  loadPipelineTransitions,
  savePipelineTransition,
} from '../../../../shared/grant-ops-persistence';
import { getSqliteState } from '../../../../shared/grant-ops-sqlite';

// Awards - read from awards_v2 typed table via direct SQLite
export async function getAwards(): Promise<Award[]> {
  const { readAwards } = await import('../../../../shared/grant-ops-sqlite');
  return readAwards(getSqliteState());
}

export async function createAward(award: Award): Promise<void> {
  const { writeAwards } = await import('../../../../shared/grant-ops-sqlite');
  const awards = await getAwards();
  awards.push(award);
  writeAwards(getSqliteState(), awards);
}

export async function getAwardByGrantId(grantId: string): Promise<Award | null> {
  const awards = await getAwards();
  return awards.find((a) => a.grantId === grantId) || null;
}

export async function updateAward(id: string, updates: Partial<Award>): Promise<void> {
  const { writeAwards } = await import('../../../../shared/grant-ops-sqlite');
  const awards = await getAwards();
  const index = awards.findIndex((a) => a.id === id);
  if (index !== -1) {
    awards[index] = { ...awards[index]!, ...updates };
    writeAwards(getSqliteState(), awards);
  }
}

export async function getBudgetCategoriesByAwardId(awardId: string): Promise<AwardBudgetCategory[]> {
  const { readAwardBudgetCategories } = await import('../../../../shared/grant-ops-sqlite');
  return readAwardBudgetCategories(getSqliteState()).filter((c) => c.awardId === awardId);
}

export async function createBudgetCategory(category: AwardBudgetCategory): Promise<void> {
  const { writeAwardBudgetCategories } = await import('../../../../shared/grant-ops-sqlite');
  const categories = await loadAwardBudgetCategories();
  categories.push(category);
  writeAwardBudgetCategories(getSqliteState(), categories);
}

export async function getExpensesByAwardId(awardId: string): Promise<AwardExpense[]> {
  const { readAwardExpenses } = await import('../../../../shared/grant-ops-sqlite');
  return readAwardExpenses(getSqliteState()).filter((e) => e.awardId === awardId);
}

export async function createExpense(expense: AwardExpense): Promise<void> {
  const { writeAwardExpenses } = await import('../../../../shared/grant-ops-sqlite');
  const expenses = await loadAwardExpenses();
  expenses.push(expense);
  writeAwardExpenses(getSqliteState(), expenses);
}

export async function getReportDeadlinesByAwardId(awardId: string): Promise<AwardReportDeadline[]> {
  const { readAwardReportDeadlines } = await import('../../../../shared/grant-ops-sqlite');
  return readAwardReportDeadlines(getSqliteState()).filter((d) => d.awardId === awardId);
}

export async function createReportDeadline(deadline: AwardReportDeadline): Promise<void> {
  const { writeAwardReportDeadlines } = await import('../../../../shared/grant-ops-sqlite');
  const deadlines = await loadAwardReportDeadlines();
  deadlines.push(deadline);
  writeAwardReportDeadlines(getSqliteState(), deadlines);
}

export async function getComplianceItemsByAwardId(awardId: string): Promise<AwardComplianceItem[]> {
  const { readAwardComplianceItems } = await import('../../../../shared/grant-ops-sqlite');
  return readAwardComplianceItems(getSqliteState()).filter((i) => i.awardId === awardId);
}

export async function createComplianceItem(item: AwardComplianceItem): Promise<void> {
  const { writeAwardComplianceItems } = await import('../../../../shared/grant-ops-sqlite');
  const items = await loadAwardComplianceItems();
  items.push(item);
  writeAwardComplianceItems(getSqliteState(), items);
}

export async function getSnippets(): Promise<DraftSnippet[]> {
  return loadDraftSnippets();
}

export async function createSnippet(snippet: DraftSnippet): Promise<void> {
  const snippets = await loadDraftSnippets();
  snippets.push(snippet);
  await saveDraftSnippets(snippets);
}

export async function getOutreachRecords(): Promise<unknown[]> {
  const records = await loadOutreachRecords();
  return records as unknown[];
}

export async function createOutreachRecord(record: unknown): Promise<void> {
  const r = record as { id: string; grantId: string; funderId?: string | null; contactName?: string; contactEmail?: string; method?: string; notes?: string; outcome?: string; followUpDate?: string; createdAt: string };
  await saveOutreachRecord(r);
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  return loadSavedSearches();
}

export async function createSavedSearch(search: SavedSearch): Promise<void> {
  const searches = await loadSavedSearches();
  searches.push(search);
  await saveSavedSearches(searches);
}

export async function getFormTemplates(): Promise<unknown[]> {
  const templates = await loadFormTemplates();
  return templates as unknown[];
}

export async function createFormTemplate(template: unknown): Promise<void> {
  const t = template as { id: string; name: string; funderId?: string | null; fields?: unknown[]; createdAt: string };
  await saveFormTemplate(t);
}

export async function getFunderProfiles(): Promise<FunderProfile[]> {
  return loadFunderProfiles();
}

export async function createFunderProfile(profile: FunderProfile): Promise<void> {
  const profiles = await loadFunderProfiles();
  profiles.push(profile);
  await saveFunderProfiles(profiles);
}

export async function getPipelineTransitionsByGrantId(grantId: string): Promise<PipelineTransition[]> {
  return loadPipelineTransitions(grantId);
}

export async function createPipelineTransition(transition: PipelineTransition): Promise<void> {
  await savePipelineTransition(transition);
}
