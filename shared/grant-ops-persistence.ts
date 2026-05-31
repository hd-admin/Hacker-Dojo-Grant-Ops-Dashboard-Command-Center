/**
 * Shared Grant Ops Persistence
 *
 * Public async façade over the sqlite-backed grant operations store.
 */

import 'server-only';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  clearDatabase,
  getSqliteState,
  readAuditEvents as readAuditEventsFromSqlite,
  readConflictRecords as readConflictRecordsFromSqlite,
  readDuplicateCandidates as readDuplicateCandidatesFromSqlite,
  readGrants as readGrantsFromSqlite,
  readJobQueue as readJobQueueFromSqlite,
  readJobQueueItem as readJobQueueItemFromSqlite,
  readOpencodeSettings as readOpencodeSettingsFromSqlite,
  readPersistedData as readPersistedDataFromSqlite,
  readProfile as readProfileFromSqlite,
  readSubmissionManifests as readSubmissionManifestsFromSqlite,
  readBackupFreshness as readBackupFreshnessFromSqlite,
  readCrawlSchedules as readCrawlSchedulesFromSqlite,
  readFunderProfiles as readFunderProfilesFromSqlite,
  readSavedSearches as readSavedSearchesFromSqlite,
  readAwards as readAwardsFromSqlite,
  readAwardBudgetCategories as readAwardBudgetCategoriesFromSqlite,
  readAwardExpenses as readAwardExpensesFromSqlite,
  readPlannedExpenses as readPlannedExpensesFromSqlite,
  readAwardReportDeadlines as readAwardReportDeadlinesFromSqlite,
  readAwardComplianceItems as readAwardComplianceItemsFromSqlite,
  readDraftSnippets as readDraftSnippetsFromSqlite,
  readPeerDiscoveryResults as readPeerDiscoveryResultsFromSqlite,
  resolveDataDir,
  resetSqliteCache,
  removeApprovalRecordByGrantId as removeApprovalRecordByGrantIdFromSqlite,
  saveAuditEvent as saveAuditEventToSqlite,
  saveConflictRecord as saveConflictRecordToSqlite,
  saveDuplicateCandidate as saveDuplicateCandidateToSqlite,
  saveJobQueueItem as saveJobQueueItemToSqlite,
  saveSubmissionManifest as saveSubmissionManifestToSqlite,
  saveBackupVerificationRecord as saveBackupVerificationRecordToSqlite,
  saveBackupFreshness as saveBackupFreshnessToSqlite,
  upsertCrawlSchedule as upsertCrawlScheduleToSqlite,
  deleteCrawlSchedule as deleteCrawlScheduleFromSqlite,
  updateConflictRecord as updateConflictRecordToSqlite,
  updateDuplicateCandidate as updateDuplicateCandidateToSqlite,
  updateJobQueueItem as updateJobQueueItemToSqlite,
  writeGrants as writeGrantsToSqlite,
  writeFunderProfiles as writeFunderProfilesToSqlite,
  writeSavedSearches as writeSavedSearchesToSqlite,
  writeAwards as writeAwardsToSqlite,
  writeAwardBudgetCategories as writeAwardBudgetCategoriesToSqlite,
  writeAwardExpenses as writeAwardExpensesToSqlite,
  writePlannedExpenses as writePlannedExpensesToSqlite,
  writeAwardReportDeadlines as writeAwardReportDeadlinesToSqlite,
  writeAwardComplianceItems as writeAwardComplianceItemsToSqlite,
  writeDraftSnippets as writeDraftSnippetsToSqlite,
  writePeerDiscoveryResults as writePeerDiscoveryResultsToSqlite,
  writeOpencodeSettings as writeOpencodeSettingsToSqlite,
  writePersistedData as writePersistedDataToSqlite,
  writeProfile as writeProfileToSqlite,
  readThemesData as readThemesDataFromSqlite,
  writeThemesData as writeThemesDataToSqlite,
} from './grant-ops-sqlite';
import {
  defaultOpencodeSettings,
} from './seed-data';
import {
  testFixtureGrants,
  propublicaSourceFixture,
  testProfile,
} from './test-fixtures';
import type {
  ApprovalRecord,
  AuditEvent,
  Award,
  AwardBudgetCategory,
  AwardComplianceItem,
  AwardExpense,
  AwardReportDeadline,
  ConflictRecord,
  CrawlRun,
  DocumentMetadata,
  DraftArtifact,
  DraftSnippet,
  DuplicateCandidate,
  FollowUp,
  FunderProfile,
  Grant,
  JobQueueItem,
  Notification,
  OpencodeSettings,
  OrganizationProfile,
  PeerDiscoveryResult,
  PlannedExpense,
  RevisionRequest,
  SavedSearch,
  Source,
  SubmissionManifest,
  SubmissionRecord,
  Task,
  ThemesData,
} from './types';

export function getDataDir(): string {
  return resolveDataDir();
}

export function getDATA_DIR(): string {
  return getDataDir();
}

export const DATA_DIR = getDataDir();

export interface PersistedData {
  sources: Source[];
  crawlRuns: CrawlRun[];
  draftArtifacts: DraftArtifact[];
  revisionRequests: RevisionRequest[];
  approvalRecords: ApprovalRecord[];
  submissionRecords: SubmissionRecord[];
  followUps: FollowUp[];
  opencodeSettings: OpencodeSettings | null;
  notifications: Notification[];
  tasks: Task[];
  documents: DocumentMetadata[];
  lastSync: string;
}

export const dataCache = new Map<string, PersistedData>();
export const grantsCache = new Map<string, Grant[]>();

export function getDataPath(): string {
  return path.join(getDATA_DIR(), 'grant-ops.sqlite');
}

export async function _ensureDataDir(dataPath: string): Promise<void> {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
}

async function readPersistedDataInternal(): Promise<PersistedData> {
  const state = getSqliteState();
  const dataDir = state.dataDir;
  if (dataCache.has(dataDir)) {
    const cachedData = dataCache.get(dataDir);
    if (!cachedData) {
      throw new Error('Cached persisted data missing for current data dir');
    }
    return cachedData;
  }

  const data = await readPersistedDataFromSqlite(state);
  dataCache.set(dataDir, data);
  return data;
}

export async function loadPersistedData(): Promise<PersistedData> {
  return readPersistedDataInternal();
}

export async function savePersistedData(data: PersistedData): Promise<void> {
  const dataDir = getDATA_DIR();
  dataCache.set(dataDir, data);
  await writePersistedDataToSqlite(getSqliteState(), data);
}

export function invalidateCache(): void {
  const dataDir = getDATA_DIR();
  dataCache.delete(dataDir);
  grantsCache.delete(dataDir);
  resetSqliteCache(dataDir);
}

/**
 * Normalize grant detail fields with safe defaults.
 * This is a local implementation that does not depend on seed-data helpers.
 */
function normalizeGrantDetailFields(grant: Grant): Grant {
  const normalized: Grant = {
    ...grant,
    latestDraftVersion: grant.latestDraftVersion ?? (grant.draftContent ? 1 : 0),
    groundedDocumentCount: grant.groundedDocumentCount ?? 0,
    sourceCount: grant.sourceCount ?? 0,
  };
  return normalized;
}

export async function loadGrants(): Promise<Grant[]> {
  const dataDir = getDATA_DIR();
  if (grantsCache.has(dataDir)) {
    const cachedGrants = grantsCache.get(dataDir);
    if (!cachedGrants) {
      throw new Error('Cached grants missing for current data dir');
    }
    return [...cachedGrants];
  }

  const grants = (await readGrantsFromSqlite(getSqliteState())).map((grant) =>
    normalizeGrantDetailFields(grant),
  );
  grantsCache.set(dataDir, grants);
  return [...grants];
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  const dataDir = getDATA_DIR();
  const normalizedGrants = grants.map((grant) => normalizeGrantDetailFields(grant));
  grantsCache.set(dataDir, normalizedGrants);
  dataCache.delete(dataDir);
  await writeGrantsToSqlite(getSqliteState(), normalizedGrants);
}

export async function loadProfile(): Promise<OrganizationProfile> {
  const profile = await readProfileFromSqlite(getSqliteState());
  return { ...profile };
}

export async function saveProfile(profile: OrganizationProfile): Promise<void> {
  dataCache.delete(getDATA_DIR());
  await writeProfileToSqlite(getSqliteState(), profile);
}

export async function loadOpencodeSettings(): Promise<OpencodeSettings> {
  const settings = await readOpencodeSettingsFromSqlite(getSqliteState());
  return settings ? { ...settings } : { ...defaultOpencodeSettings };
}

export async function saveOpencodeSettings(settings: OpencodeSettings): Promise<void> {
  dataCache.delete(getDATA_DIR());
  await writeOpencodeSettingsToSqlite(getSqliteState(), settings);
}

export async function loadNotifications(): Promise<Notification[]> {
  const data = await loadPersistedData();
  return data.notifications;
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  const data = await loadPersistedData();
  data.notifications = notifications;
  await savePersistedData(data);
}

export async function loadTasks(): Promise<Task[]> {
  const data = await loadPersistedData();
  return data.tasks;
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  const data = await loadPersistedData();
  data.tasks = tasks;
  await savePersistedData(data);
}

export async function loadDocuments(): Promise<DocumentMetadata[]> {
  const data = await loadPersistedData();
  return data.documents;
}

export async function saveDocuments(documents: DocumentMetadata[]): Promise<void> {
  const data = await loadPersistedData();
  data.documents = documents;
  await savePersistedData(data);
}

export interface TempDataDirResult {
  dataDir: string;
  cleanup: () => Promise<void>;
}

export async function withTempDataDir(): Promise<TempDataDirResult> {
  const tempDirPath = `grant-ops-test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const tempDir = path.join(os.tmpdir(), tempDirPath);
  await fs.mkdir(tempDir, { recursive: true });

  const originalDataDir: string | undefined = process.env.DATA_DIR;
  process.env.DATA_DIR = tempDir;
  invalidateCache();

  return {
    dataDir: tempDir,
    cleanup: async () => {
      if (originalDataDir === undefined) {
        delete process.env.DATA_DIR;
      } else {
        process.env.DATA_DIR = originalDataDir;
      }
      invalidateCache();
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

export async function copyPersistedData(
  fromDir: string,
  toDir: string,
  filenames: string[],
): Promise<void> {
  await fs.mkdir(toDir, { recursive: true });
  for (const filename of filenames) {
    try {
      const content = await fs.readFile(path.join(fromDir, filename), 'utf8');
      await fs.writeFile(path.join(toDir, filename), content, 'utf8');
    } catch {
      // ignore missing files for tests
    }
  }
}

export async function resetPersistentStateForTests(): Promise<void> {
  invalidateCache();
  const state = getSqliteState();
  await clearDatabase(state);
  await saveProfile({ ...testProfile });
  await saveOpencodeSettings({ ...defaultOpencodeSettings });
  await writeGrantsToSqlite(state, testFixtureGrants);
  await writePersistedDataToSqlite(state, {
    sources: [propublicaSourceFixture],
    crawlRuns: [],
    draftArtifacts: [],
    revisionRequests: [],
    approvalRecords: [],
    submissionRecords: [],
    followUps: [],
    notifications: [],
    tasks: [],
    documents: [],
    opencodeSettings: defaultOpencodeSettings,
    lastSync: new Date().toISOString(),
  });
}

export async function loadAuditEvents(limit?: number): Promise<AuditEvent[]> {
  return readAuditEventsFromSqlite(getSqliteState(), limit);
}

export async function saveAuditEvent(event: AuditEvent): Promise<void> {
  await saveAuditEventToSqlite(getSqliteState(), event);
}

export async function loadJobQueue(status?: string): Promise<JobQueueItem[]> {
  return readJobQueueFromSqlite(getSqliteState(), status);
}

export async function loadJobQueueItem(id: string): Promise<JobQueueItem | null> {
  return readJobQueueItemFromSqlite(getSqliteState(), id);
}

export async function saveJobQueueItem(item: JobQueueItem): Promise<void> {
  await saveJobQueueItemToSqlite(getSqliteState(), item);
}

export async function updateJobQueueItemPersistence(id: string, updates: Partial<JobQueueItem>): Promise<void> {
  await updateJobQueueItemToSqlite(getSqliteState(), id, updates);
}

export async function loadDuplicateCandidates(status?: string): Promise<DuplicateCandidate[]> {
  return readDuplicateCandidatesFromSqlite(getSqliteState(), status);
}

export async function saveDuplicateCandidate(item: DuplicateCandidate): Promise<void> {
  await saveDuplicateCandidateToSqlite(getSqliteState(), item);
}

export async function updateDuplicateCandidatePersistence(id: string, updates: Partial<DuplicateCandidate>): Promise<void> {
  await updateDuplicateCandidateToSqlite(getSqliteState(), id, updates);
}

export async function loadConflictRecords(grantId?: string): Promise<ConflictRecord[]> {
  return readConflictRecordsFromSqlite(getSqliteState(), grantId);
}

export async function saveConflictRecord(item: ConflictRecord): Promise<void> {
  await saveConflictRecordToSqlite(getSqliteState(), item);
}

export async function updateConflictRecordPersistence(id: string, updates: Partial<ConflictRecord>): Promise<void> {
  await updateConflictRecordToSqlite(getSqliteState(), id, updates);
}

export async function loadSubmissionManifests(grantId?: string): Promise<SubmissionManifest[]> {
  return readSubmissionManifestsFromSqlite(getSqliteState(), grantId);
}

export async function saveSubmissionManifest(item: SubmissionManifest): Promise<void> {
  await saveSubmissionManifestToSqlite(getSqliteState(), item);
}

export async function removeApprovalRecordPersistence(grantId: string): Promise<void> {
  await removeApprovalRecordByGrantIdFromSqlite(getSqliteState(), grantId);
}

export async function loadBackupFreshness(): Promise<import('./types').BackupFreshnessStatus> {
  return readBackupFreshnessFromSqlite(getSqliteState());
}

export async function saveBackupVerificationRecord(record: import('./types').BackupVerificationRecord): Promise<void> {
  await saveBackupVerificationRecordToSqlite(getSqliteState(), record);
}

export async function saveBackupFreshness(freshness: import('./types').BackupFreshnessStatus): Promise<void> {
  await saveBackupFreshnessToSqlite(getSqliteState(), freshness);
}

export async function loadCrawlSchedules(): Promise<import('./types').CrawlSchedule[]> {
  return readCrawlSchedulesFromSqlite(getSqliteState());
}

export async function saveCrawlSchedule(schedule: import('./types').CrawlSchedule): Promise<void> {
  await upsertCrawlScheduleToSqlite(getSqliteState(), schedule);
}

export async function deleteCrawlSchedule(id: string): Promise<void> {
  await deleteCrawlScheduleFromSqlite(getSqliteState(), id);
}

// ============ THEMES DATA PERSISTENCE ============

export async function loadThemesData(): Promise<ThemesData> {
  return readThemesDataFromSqlite(getSqliteState());
}

export async function saveThemesData(data: ThemesData): Promise<void> {
  writeThemesDataToSqlite(getSqliteState(), data);
}

export async function loadFunderProfiles(): Promise<FunderProfile[]> {
  return readFunderProfilesFromSqlite(getSqliteState());
}

export async function saveFunderProfiles(profiles: FunderProfile[]): Promise<void> {
  writeFunderProfilesToSqlite(getSqliteState(), profiles);
}

export async function loadSavedSearches(): Promise<SavedSearch[]> {
  return readSavedSearchesFromSqlite(getSqliteState());
}

export async function saveSavedSearches(searches: SavedSearch[]): Promise<void> {
  writeSavedSearchesToSqlite(getSqliteState(), searches);
}

export async function loadAwards(): Promise<Award[]> {
  return readAwardsFromSqlite(getSqliteState());
}

export async function saveAwards(awards: Award[]): Promise<void> {
  writeAwardsToSqlite(getSqliteState(), awards);
}

export async function loadAwardBudgetCategories(): Promise<AwardBudgetCategory[]> {
  return readAwardBudgetCategoriesFromSqlite(getSqliteState());
}

export async function saveAwardBudgetCategories(categories: AwardBudgetCategory[]): Promise<void> {
  writeAwardBudgetCategoriesToSqlite(getSqliteState(), categories);
}

export async function loadAwardExpenses(): Promise<AwardExpense[]> {
  return readAwardExpensesFromSqlite(getSqliteState());
}

export async function saveAwardExpenses(expenses: AwardExpense[]): Promise<void> {
  writeAwardExpensesToSqlite(getSqliteState(), expenses);
}

export async function loadPlannedExpenses(): Promise<PlannedExpense[]> {
  return readPlannedExpensesFromSqlite(getSqliteState());
}

export async function savePlannedExpenses(expenses: PlannedExpense[]): Promise<void> {
  writePlannedExpensesToSqlite(getSqliteState(), expenses);
}

export async function loadAwardReportDeadlines(): Promise<AwardReportDeadline[]> {
  return readAwardReportDeadlinesFromSqlite(getSqliteState());
}

export async function saveAwardReportDeadlines(deadlines: AwardReportDeadline[]): Promise<void> {
  writeAwardReportDeadlinesToSqlite(getSqliteState(), deadlines);
}

export async function loadAwardComplianceItems(): Promise<AwardComplianceItem[]> {
  return readAwardComplianceItemsFromSqlite(getSqliteState());
}

export async function saveAwardComplianceItems(items: AwardComplianceItem[]): Promise<void> {
  writeAwardComplianceItemsToSqlite(getSqliteState(), items);
}

export async function loadDraftSnippets(): Promise<DraftSnippet[]> {
  return readDraftSnippetsFromSqlite(getSqliteState());
}

export async function saveDraftSnippets(snippets: DraftSnippet[]): Promise<void> {
  writeDraftSnippetsToSqlite(getSqliteState(), snippets);
}

export async function loadPeerDiscoveryResults(): Promise<PeerDiscoveryResult[]> {
  return readPeerDiscoveryResultsFromSqlite(getSqliteState());
}

export async function savePeerDiscoveryResults(results: PeerDiscoveryResult[]): Promise<void> {
  writePeerDiscoveryResultsToSqlite(getSqliteState(), results);
}
