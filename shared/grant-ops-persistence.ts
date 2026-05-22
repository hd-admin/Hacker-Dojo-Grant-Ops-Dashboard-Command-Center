/**
 * Shared Grant Ops Persistence
 *
 * Provides a unified file-based persistence layer for grant operations data.
 * Used by the Next.js API server for reading and writing grant operations data.
 *
 * All data is stored in the `.grant-ops-data/` directory relative to the
 * project root.
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
// Canonical data directory - relative to project root
// Resolved from the workspace root to support both dev server and tests
// This ensures tests and app use the same path regardless of working directory
export function getDataDir(): string {
  // Use environment variable if set
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  // Get the project root from process.cwd() (the working directory where the app started)
  // This correctly resolves to <repo>/.grant-ops-data when running from the repo root
  return path.join(process.cwd(), '.grant-ops-data');
}

// Lazy initialization for DATA_DIR to avoid module-level path resolution issues
let _DATA_DIR: string | null = null;

export function getDATA_DIR(): string {
  if (_DATA_DIR === null) {
    _DATA_DIR = getDataDir();
  }
  return _DATA_DIR;
}

// Backward compatibility - deprecated, use getDATA_DIR() instead
// NOTE: This now delegates to getDATA_DIR() to ensure consistent path resolution
// that respects process.cwd() and environment variables, avoiding machine-specific paths
export const DATA_DIR = getDATA_DIR();

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
  return `${getDATA_DIR()}/persisted-data.json`;
}

export async function _ensureDataDir(dataPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const dir = path.dirname(dataPath);
  await fs.mkdir(dir, { recursive: true });
}

export async function loadPersistedData(): Promise<PersistedData> {
  const dataDir = getDATA_DIR();
  if (dataCache.has(dataDir)) {
    return dataCache.get(dataDir)!;
  }

  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(dataDir, 'persisted-data.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const cached = JSON.parse(raw);
    dataCache.set(dataDir, cached);
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
    dataCache.set(dataDir, defaultData);
    return defaultData;
  }
}

export async function savePersistedData(data: PersistedData): Promise<void> {
  const dataDir = getDATA_DIR();
  dataCache.set(dataDir, data);
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(dataDir, 'persisted-data.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save data:', error);
  }
}

export function invalidateCache(): void {
  const dataDir = getDATA_DIR();
  dataCache.delete(dataDir);
  grantsCache.delete(dataDir);
}

// ============ Convenience load/save helpers for grant operations ============

export async function loadGrants(): Promise<Grant[]> {
  const dataDir = getDATA_DIR();
  if (grantsCache.has(dataDir)) {
    return [...grantsCache.get(dataDir)!]; // Return a copy to prevent mutation
  }

  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(dataDir, 'grants.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    const grants = JSON.parse(raw);
    grantsCache.set(dataDir, grants);
    return grants;
  } catch {
    // Return seed grants when no persisted file exists
    // Return a copy to prevent mutation of the module-level seedGrants array
    const grants = [...seedGrants];
    grantsCache.set(dataDir, grants);
    return grants;
  }
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  const dataDir = getDATA_DIR();
  // Update cache first to ensure consistency
  grantsCache.set(dataDir, grants);
  
  const fs = await import('fs/promises');
  const dataPath = path.join(dataDir, 'grants.json');
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
    const dataPath = path.join(getDATA_DIR(), 'profile.json');
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
    const dataPath = path.join(getDATA_DIR(), 'profile.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save profile:', error);
  }
}

export async function loadOpencodeSettings(): Promise<OpencodeSettings> {
  try {
    const fs = await import('fs/promises');
    const dataPath = path.join(getDATA_DIR(), 'opencode-settings.json');
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
    const dataPath = path.join(getDATA_DIR(), 'opencode-settings.json');
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
