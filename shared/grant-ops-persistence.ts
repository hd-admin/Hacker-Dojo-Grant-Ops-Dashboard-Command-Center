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
 * application root (process.cwd() for Next.js, app.getPath('userData') for Electron).
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
  lastSync: string;
}

// In-memory cache for server-side persistence (Next.js API routes)
let dataCache: PersistedData | null = null;

export function getDataPath(): string {
  return `${DATA_DIR}/persisted-data.json`;
}

export async function _ensureDataDir(dataPath: string): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const dir = path.dirname(dataPath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Directory may already exist
  }
}

export async function loadPersistedData(): Promise<PersistedData> {
  if (dataCache) {
    return dataCache;
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), getDataPath());
    const raw = await fs.readFile(dataPath, 'utf-8');
    dataCache = JSON.parse(raw);
    return dataCache!;
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
      lastSync: new Date().toISOString(),
    };
    dataCache = defaultData;
    return defaultData;
  }
}

export async function savePersistedData(data: PersistedData): Promise<void> {
  dataCache = data;
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), getDataPath());
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save data:', error);
  }
}

export function invalidateCache(): void {
  dataCache = null;
}

// ============ Convenience load/save helpers for grant operations ============

export async function loadGrants(): Promise<Grant[]> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'grants.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    // Return seed grants when no persisted file exists
    return seedGrants;
  }
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'grants.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(grants, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save grants:', error);
  }
}

export async function loadProfile(): Promise<OrganizationProfile> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'profile.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultProfile;
  }
}

export async function saveProfile(profile: OrganizationProfile): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'profile.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save profile:', error);
  }
}

export async function loadOpencodeSettings(): Promise<OpencodeSettings> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'opencode-settings.json');
    const raw = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return defaultOpencodeSettings;
  }
}

export async function saveOpencodeSettings(settings: OpencodeSettings): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'opencode-settings.json');
    await _ensureDataDir(dataPath);
    await fs.writeFile(dataPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (error) {
    console.error('[grant-ops-persistence] Failed to save opencode settings:', error);
  }
}
