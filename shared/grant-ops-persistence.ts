/**
 * Shared Grant Ops Persistence
 *
 * Public async façade over the sqlite-backed grant operations store.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  clearDatabase,
  getSqliteState,
  readGrants as readGrantsFromSqlite,
  readOpencodeSettings as readOpencodeSettingsFromSqlite,
  readPersistedData as readPersistedDataFromSqlite,
  readProfile as readProfileFromSqlite,
  resolveDataDir,
  resetSqliteCache,
  writeGrants as writeGrantsToSqlite,
  writeOpencodeSettings as writeOpencodeSettingsToSqlite,
  writePersistedData as writePersistedDataToSqlite,
  writeProfile as writeProfileToSqlite,
} from './grant-ops-sqlite';
import {
  defaultOpencodeSettings,
} from './seed-data';
import type {
  ApprovalRecord,
  CrawlRun,
  DocumentMetadata,
  DraftArtifact,
  FollowUp,
  Grant,
  Notification,
  OpencodeSettings,
  OrganizationProfile,
  RevisionRequest,
  Source,
  SubmissionRecord,
  Task,
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

export async function loadGrants(): Promise<Grant[]> {
  const dataDir = getDATA_DIR();
  if (grantsCache.has(dataDir)) {
    const cachedGrants = grantsCache.get(dataDir);
    if (!cachedGrants) {
      throw new Error('Cached grants missing for current data dir');
    }
    return [...cachedGrants];
  }

  const grants = await readGrantsFromSqlite(getSqliteState());
  grantsCache.set(dataDir, grants);
  return [...grants];
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  const dataDir = getDATA_DIR();
  grantsCache.set(dataDir, grants);
  dataCache.delete(dataDir);
  await writeGrantsToSqlite(getSqliteState(), grants);
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
  await clearDatabase(getSqliteState());
  invalidateCache();
}
