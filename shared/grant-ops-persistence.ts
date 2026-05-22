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

import path from 'path';

import { defaultProfile, defaultOpencodeSettings, seedGrants, seedNotifications, seedTasks } from './seed-data';
// Canonical data directory - always at repo root, NOT relative to process.cwd()
// This ensures tests and app use the same path regardless of working directory
// Hardcoded to project root to avoid path resolution issues in different runtime contexts
export const DATA_DIR = '/Users/mistlight/Projects/Experiments/HackerDojoGrantApp/.grant-ops-data';

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
// Keyed by DATA_DIR to ensure single canonical cache
export const dataCache = new Map<string, PersistedData>();

// Separate cache for grants to ensure consistency with loadGrants/saveGrants
export const grantsCache = new Map<string, Grant[]>();

export function getDataPath(): string {
  return `${DATA_DIR}/persisted-data.json`;
}

export async function _ensureDataDir(dataPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const dir = path.dirname(dataPath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadPersistedData(): Promise<PersistedData> {
  if (dataCache.has(DATA_DIR)) {
    return dataCache.get(DATA_DIR)!;
  }

  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'persisted-data.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const cached = JSON.parse(raw);
    dataCache.set(DATA_DIR, cached);
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
      notifications: [...seedNotifications],
      tasks: [...seedTasks],
      documents: [],
      lastSync: new Date().toISOString(),
    };
    dataCache.set(DATA_DIR, defaultData);
    return defaultData;
  }
}

export async function savePersistedData(data: PersistedData): Promise<void> {
  dataCache.set(DATA_DIR, data);
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'persisted-data.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save data:', error);
  }
}

export function invalidateCache(): void {
  dataCache.delete(DATA_DIR);
  grantsCache.delete(DATA_DIR);
}

// ============ Convenience load/save helpers for grant operations ============

export async function loadGrants(): Promise<Grant[]> {
  if (grantsCache.has(DATA_DIR)) {
    return [...grantsCache.get(DATA_DIR)!]; // Return a copy to prevent mutation
  }

  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'grants.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const grants = JSON.parse(raw);
    grantsCache.set(DATA_DIR, grants);
    return grants;
  } catch {
    // Return seed grants when no persisted file exists
    // Return a copy to prevent mutation of the module-level seedGrants array
    const grants = [...seedGrants];
    grantsCache.set(DATA_DIR, grants);
    return grants;
  }
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  // Update cache first to ensure consistency
  grantsCache.set(DATA_DIR, grants);
  
  const fs = await import('fs/promises');
  const dataPath = path.join(DATA_DIR, 'grants.json');
  await _ensureDataDir(dataPath);
  try {
    await fs.writeFile(dataPath, JSON.stringify(grants, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save grants:', error);
    throw error; // Propagate to caller so they know the save failed
  }
}

export async function loadProfile(): Promise<OrganizationProfile> {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'profile.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return a copy to prevent mutation of the module-level defaultProfile
    return { ...defaultProfile };
  }
}

export async function saveProfile(profile: OrganizationProfile): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'profile.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save profile:', error);
  }
}

export async function loadOpencodeSettings(): Promise<OpencodeSettings> {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'opencode-settings.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return a copy to prevent mutation of the module-level defaultOpencodeSettings
    return { ...defaultOpencodeSettings };
  }
}

export async function saveOpencodeSettings(settings: OpencodeSettings): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(DATA_DIR, 'opencode-settings.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save opencode settings:', error);
  }
}

// ============ Notifications ============

export async function loadNotifications(): Promise<Notification[]> {
  const data = await loadPersistedData();
  return data.notifications;
}

export async function saveNotifications(notifications: Notification[]): Promise<void> {
  const data = await loadPersistedData();
  data.notifications = notifications;
  await savePersistedData(data);
}

// ============ Tasks ============

export async function loadTasks(): Promise<Task[]> {
  const data = await loadPersistedData();
  return data.tasks;
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  const data = await loadPersistedData();
  data.tasks = tasks;
  await savePersistedData(data);
}

// ============ Documents ============

export async function loadDocuments(): Promise<import('./types').DocumentMetadata[]> {
  const data = await loadPersistedData();
  return data.documents;
}

export async function saveDocuments(documents: import('./types').DocumentMetadata[]): Promise<void> {
  const data = await loadPersistedData();
  data.documents = documents;
  await savePersistedData(data);
}
