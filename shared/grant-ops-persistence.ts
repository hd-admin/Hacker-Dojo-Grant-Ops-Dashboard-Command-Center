/**
 * Shared Grant Ops Persistence
 *
 * Provides a unified file-based persistence layer for grant operations data.
 * This adapter is used by both:
 *   - The Next.js API server (repository.ts)
 *   - The Electron main process (store.ts)
 *
 * GAP-01: Unifies the data source so Electron IPC reads and Next API writes
 * operate on the same persisted state.
 *
 * All data is stored in the `.grant-ops-data/` directory relative to the
 * base directory. The base directory defaults to `process.cwd()` for Next.js
 * contexts, but can be overridden for Electron by passing app.getPath('userData').
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
  DocumentMetadata,
} from './types';

import { defaultProfile, defaultOpencodeSettings, seedGrants } from './seed-data';

export const DATA_DIR = '.grant-ops-data';

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

// In-memory cache for server-side persistence (Next.js API routes)
// Keyed by baseDir to support multiple base directories
const dataCache = new Map<string, PersistedData>();

export function getDataPath(baseDir?: string): string {
  return `${baseDir ?? process.cwd()}/${DATA_DIR}/persisted-data.json`;
}

export async function _ensureDataDir(dataPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.dirname(dataPath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadPersistedData(baseDir?: string): Promise<PersistedData> {
  const cwd = baseDir ?? process.cwd();
  if (dataCache.has(cwd)) {
    return dataCache.get(cwd)!;
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'persisted-data.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const cached = JSON.parse(raw);
    dataCache.set(cwd, cached);
    return cached;
  } catch {
    // Return default data if file doesn't exist
    const defaultData: PersistedData = {
      sources: [],
      crawlRuns: [],
      draftArtifacts: [],
      revisionRequests: [],
      approvalRecords: [],
      submissionRecords: [],
      followUps: [],
      opencodeSettings: defaultOpencodeSettings,
      notifications: [],
      tasks: [],
      documents: [],
      lastSync: new Date().toISOString(),
    };
    dataCache.set(cwd, defaultData);
    return defaultData;
  }
}

export async function savePersistedData(data: PersistedData, baseDir?: string): Promise<void> {
  const cwd = baseDir ?? process.cwd();
  dataCache.set(cwd, data);
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'persisted-data.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save data:', error);
  }
}

export function invalidateCache(baseDir?: string): void {
  const cwd = baseDir ?? process.cwd();
  dataCache.delete(cwd);
}

// ============ Convenience load/save helpers for grant operations ============

export async function loadGrants(baseDir?: string): Promise<Grant[]> {
  const cwd = baseDir ?? process.cwd();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'grants.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return seed grants when no persisted file exists
    // Return a copy to prevent mutation of the module-level seedGrants array
    return [...seedGrants];
  }
}

export async function saveGrants(grants: Grant[], baseDir?: string): Promise<void> {
  const cwd = baseDir ?? process.cwd();
  const fs = await import('fs/promises');
  const path = await import('path');
  const dataPath = path.join(cwd, DATA_DIR, 'grants.json');
  await _ensureDataDir(dataPath);
  try {
    await fs.writeFile(dataPath, JSON.stringify(grants, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save grants:', error);
    throw error; // Propagate to caller so they know the save failed
  }
}

export async function loadProfile(baseDir?: string): Promise<OrganizationProfile> {
  const cwd = baseDir ?? process.cwd();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'profile.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return a copy to prevent mutation of the module-level defaultProfile
    return { ...defaultProfile };
  }
}

export async function saveProfile(profile: OrganizationProfile, baseDir?: string): Promise<void> {
  const cwd = baseDir ?? process.cwd();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'profile.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save profile:', error);
  }
}

export async function loadOpencodeSettings(baseDir?: string): Promise<OpencodeSettings> {
  const cwd = baseDir ?? process.cwd();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'opencode-settings.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return a copy to prevent mutation of the module-level defaultOpencodeSettings
    return { ...defaultOpencodeSettings };
  }
}

export async function saveOpencodeSettings(settings: OpencodeSettings, baseDir?: string): Promise<void> {
  const cwd = baseDir ?? process.cwd();
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(cwd, DATA_DIR, 'opencode-settings.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save opencode settings:', error);
  }
}

// ============ Notifications ============

export async function loadNotifications(baseDir?: string): Promise<Notification[]> {
  const data = await loadPersistedData(baseDir);
  return data.notifications;
}

export async function saveNotifications(notifications: Notification[], baseDir?: string): Promise<void> {
  const data = await loadPersistedData(baseDir);
  data.notifications = notifications;
  await savePersistedData(data, baseDir);
}

// ============ Tasks ============

export async function loadTasks(baseDir?: string): Promise<Task[]> {
  const data = await loadPersistedData(baseDir);
  return data.tasks;
}

export async function saveTasks(tasks: Task[], baseDir?: string): Promise<void> {
  const data = await loadPersistedData(baseDir);
  data.tasks = tasks;
  await savePersistedData(data, baseDir);
}

// ============ Documents ============

export async function loadDocuments(baseDir?: string): Promise<import('./types').DocumentMetadata[]> {
  const data = await loadPersistedData(baseDir);
  return data.documents;
}

export async function saveDocuments(documents: import('./types').DocumentMetadata[], baseDir?: string): Promise<void> {
  const data = await loadPersistedData(baseDir);
  data.documents = documents;
  await savePersistedData(data, baseDir);
}
