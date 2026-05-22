/**
 * Repository Layer
 *
 * Provides a clean interface for persisting and retrieving grant operations data.
 * This acts as a bridge between the Next.js API routes and the Electron store via IPC.
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
} from '../../../../shared/types';

// Since this runs in the Next.js server context, we need to make HTTP calls to the Electron IPC bridge
// For now, we'll use a file-based persistence layer for the standalone Next.js build

const DATA_DIR = '.grant-ops-data';

interface PersistedData {
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

// In-memory cache for server-side persistence
let dataCache: PersistedData | null = null;

function getDataPath(): string {
  return `${DATA_DIR}/persisted-data.json`;
}

async function _ensureDataDir(): Promise<void> {
  // In Next.js standalone mode, we use the filesystem
  // This is a simplified implementation
}

async function loadPersistedData(): Promise<PersistedData> {
  if (dataCache) {
    return dataCache;
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), getDataPath());
    const data = await fs.readFile(dataPath, 'utf-8');
    dataCache = JSON.parse(data);
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
      opencodeSettings: null,
      lastSync: new Date().toISOString(),
    };
    dataCache = defaultData;
    return defaultData;
  }
}

async function savePersistedData(data: PersistedData): Promise<void> {
  dataCache = data;
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), getDataPath());

    // Ensure directory exists
    const dir = path.dirname(dataPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory may already exist
    }

    await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save persisted data:', error);
  }
}

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
  data.sources = data.sources.filter((s) => s.id !== id);
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

// DraftArtifact operations
export async function getDraftArtifacts(grantId: string): Promise<DraftArtifact[]> {
  const data = await loadPersistedData();
  return data.draftArtifacts.filter((d) => d.grantId === grantId);
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
  return data.revisionRequests.filter((r) => r.grantId === grantId);
}

export async function addRevisionRequest(request: RevisionRequest): Promise<void> {
  const data = await loadPersistedData();
  data.revisionRequests.push(request);
  await savePersistedData(data);
}

// ApprovalRecord operations
export async function getApprovalRecord(grantId: string): Promise<ApprovalRecord | null> {
  const data = await loadPersistedData();
  return data.approvalRecords.find((r) => r.grantId === grantId) || null;
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
  return data.submissionRecords.find((r) => r.grantId === grantId) || null;
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
  const index = data.followUps.findIndex((f) => f.id === followUp.id);
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

// Grants operations (simple file-based for now)
export async function getGrants(): Promise<Grant[]> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'grants.json');
    const data = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function saveGrants(grants: Grant[]): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'grants.json');
    const dir = path.dirname(dataPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory may exist
    }
    await fs.writeFile(dataPath, JSON.stringify(grants, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save grants:', error);
  }
}

export async function getGrant(id: string): Promise<Grant | null> {
  const grants = await getGrants();
  return grants.find((g) => g.id === id) || null;
}

export async function updateGrant(id: string, updates: Partial<Grant>): Promise<void> {
  const grants = await getGrants();
  const index = grants.findIndex((g) => g.id === id);
  if (index !== -1) {
    const existing = grants[index]!;
    grants[index] = { ...existing, ...updates } as Grant;
    await saveGrants(grants);
  }
}

export async function addGrant(grant: Grant): Promise<void> {
  const grants = await getGrants();
  grants.push(grant);
  await saveGrants(grants);
}

// Organization profile operations
export async function getOrgProfile(): Promise<OrganizationProfile | null> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'profile.json');
    const data = await fs.readFile(dataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function updateOrgProfile(profile: OrganizationProfile): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const dataPath = path.join(process.cwd(), DATA_DIR, 'profile.json');
    const dir = path.dirname(dataPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Directory may exist
    }
    await fs.writeFile(dataPath, JSON.stringify(profile, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save profile:', error);
  }
}
