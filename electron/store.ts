import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import {
  Grant,
  OrganizationProfile,
  ActivityEvent,
  CrawlStatus,
  Notification,
  Task,
  DocumentMetadata,
  Source,
  CrawlRun,
  DraftArtifact,
  RevisionRequest,
  ApprovalRecord,
  SubmissionRecord,
  FollowUp,
  OpencodeSettings,
  StoreData,
} from '../shared/types';

// Import seed data from shared module (GAP-01 fix: eliminates duplication)
import { defaultProfile, defaultOpencodeSettings, seedGrants } from '../shared/seed-data';
import {
  loadGrants,
  saveGrants,
  loadProfile,
  saveProfile,
  loadOpencodeSettings,
  saveOpencodeSettings,
} from '../shared/grant-ops-persistence';

// Note: seedGrants, defaultProfile, and defaultOpencodeSettings are imported from '../shared/seed-data'
// They are reused by both electron/store.ts and repository.ts

class Store {
  private data: StoreData;
  private storePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private baseDir: string;

  constructor() {
    // Use process.cwd() as base directory for consistency with repository.ts
    // This ensures both electron/store.ts and repository.ts read/write to the same files
    this.baseDir = process.cwd();
    this.storePath = path.join(this.baseDir, '.grant-ops-data', 'store.json');
    this.data = this.loadStore();
    // Async load from persistence to ensure consistency
    this.syncWithPersistence();
  }

  private loadStore(): StoreData {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, 'utf-8');
        const parsed = JSON.parse(data);
        log.info('Store loaded from:', this.storePath);
        // Migration: add new fields with defaults if missing from persisted store
        return {
          grants: parsed.grants || seedGrants,
          profile: parsed.profile || defaultProfile,
          crawlStatus: parsed.crawlStatus || { online: true, lastSync: new Date().toISOString() },
          notifications: parsed.notifications || [],
          tasks: parsed.tasks || [],
          documents: parsed.documents || [],
          activity: parsed.activity || [],
          sources: parsed.sources || [],
          crawlRuns: parsed.crawlRuns || [],
          draftArtifacts: parsed.draftArtifacts || [],
          revisionRequests: parsed.revisionRequests || [],
          approvalRecords: parsed.approvalRecords || [],
          submissionRecords: parsed.submissionRecords || [],
          followUps: parsed.followUps || [],
          opencodeSettings: parsed.opencodeSettings || defaultOpencodeSettings,
        };
      }
    } catch (error) {
      log.error('Error loading store:', error);
    }
    log.info('Initializing store with seed data');
    return {
      grants: seedGrants,
      profile: defaultProfile,
      crawlStatus: { online: true, lastSync: new Date().toISOString() },
      notifications: [
        {
          id: 'seed-1',
          text: '<strong>3 new grants</strong> matched from Candid weekly crawl',
          time: '2h ago',
          dot: 'success',
        },
        {
          id: 'seed-2',
          text: 'NSF TechAccess LOI deadline in <strong>26 days</strong> — checklist 4/7 complete',
          time: 'yesterday',
          dot: 'warning',
        },
        {
          id: 'seed-3',
          text: 'Crawled <strong>47 sources</strong> · 12 federal, 28 foundation, 7 corporate',
          time: '3d ago',
          dot: 'info',
        },
      ],
      tasks: [],
      documents: [],
      activity: [],
      sources: [],
      crawlRuns: [],
      draftArtifacts: [],
      revisionRequests: [],
      approvalRecords: [],
      submissionRecords: [],
      followUps: [],
      opencodeSettings: defaultOpencodeSettings,
    };
  }

  // Sync this.data with the shared persistence layer
  // This ensures electron/store.ts and repository.ts use the same data
  private async syncWithPersistence(): Promise<void> {
    try {
      // Load grants, profile, and opencodeSettings from persistence
      const [persistedGrants, persistedProfile, persistedOpencodeSettings] = await Promise.all([
        loadGrants(this.baseDir),
        loadProfile(this.baseDir),
        loadOpencodeSettings(this.baseDir),
      ]);

      // Update this.data with persisted values
      this.data.grants = persistedGrants;
      this.data.profile = persistedProfile;
      this.data.opencodeSettings = persistedOpencodeSettings;

      log.info('Store synced with persistence layer');
    } catch (error) {
      log.error('Error syncing with persistence:', error);
    }
  }

  // Save grants to both store.json and the shared persistence layer
  private async saveGrantsToPersistence(): Promise<void> {
    try {
      await saveGrants(this.data.grants, this.baseDir);
    } catch (error) {
      log.error('Error saving grants to persistence:', error);
    }
  }

  private saveStore(): void {
    // Debounce saves by 500ms
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const dir = path.dirname(this.storePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
        log.info('Store saved');
      } catch (error) {
        log.error('Error saving store:', error);
      }
    }, 500);
  }

  getGrants(): Grant[] {
    return this.data.grants;
  }

  getGrant(id: string): Grant | null {
    return this.data.grants.find((g) => g.id === id) || null;
  }

  updateGrant(id: string, updates: Partial<Grant>): void {
    const index = this.data.grants.findIndex((g) => g.id === id);
    if (index !== -1) {
      this.data.grants[index] = { ...this.data.grants[index], ...updates };
      this.saveStore();
      // Also save to shared persistence layer (GAP-01 fix)
      this.saveGrantsToPersistence();
    }
  }

  addGrant(grant: Grant): void {
    this.data.grants.push(grant);
    this.saveStore();
    // Also save to shared persistence layer (GAP-01 fix)
    this.saveGrantsToPersistence();
  }

  getProfile(): OrganizationProfile {
    return this.data.profile;
  }

  updateProfile(profile: OrganizationProfile): void {
    this.data.profile = profile;
    this.saveStore();
    // Also save to shared persistence layer (GAP-01 fix)
    saveProfile(profile, this.baseDir).catch((error) => {
      log.error('Error saving profile to persistence:', error);
    });
  }

  // Crawl status methods
  getCrawlStatus(): CrawlStatus {
    return this.data.crawlStatus;
  }

  updateCrawlStatus(status: CrawlStatus): void {
    this.data.crawlStatus = status;
    this.saveStore();
  }

  // Notification methods
  getNotifications(): Notification[] {
    return this.data.notifications;
  }

  updateNotifications(notifications: Notification[]): void {
    this.data.notifications = notifications;
    this.saveStore();
  }

  // Task methods
  getTasks(): Task[] {
    return this.data.tasks;
  }

  updateTasks(tasks: Task[]): void {
    this.data.tasks = tasks;
    this.saveStore();
  }

  // Document methods
  getDocuments(): DocumentMetadata[] {
    return this.data.documents;
  }

  addDocument(doc: DocumentMetadata): void {
    this.data.documents.push(doc);
    this.saveStore();
  }

  // Activity methods
  getActivity(): ActivityEvent[] {
    return this.data.activity;
  }

  addActivityEvent(event: ActivityEvent): void {
    this.data.activity.push(event);
    this.saveStore();
  }

  getRecentActivity(count: number): ActivityEvent[] {
    return this.data.activity.slice(-count);
  }

  // Sources methods
  getSources(): Source[] {
    return this.data.sources;
  }

  addSource(source: Source): void {
    this.data.sources.push(source);
    this.saveStore();
  }

  removeSource(id: string): void {
    this.data.sources = this.data.sources.filter((s) => s.id !== id);
    this.saveStore();
  }

  // CrawlRun methods
  getCrawlRuns(): CrawlRun[] {
    return this.data.crawlRuns;
  }

  getLatestCrawlRun(): CrawlRun | null {
    if (this.data.crawlRuns.length === 0) return null;
    return this.data.crawlRuns[this.data.crawlRuns.length - 1];
  }

  addCrawlRun(run: CrawlRun): void {
    this.data.crawlRuns.push(run);
    this.saveStore();
  }

  // DraftArtifact methods
  getDraftArtifacts(grantId: string): DraftArtifact[] {
    return this.data.draftArtifacts.filter((d) => d.grantId === grantId);
  }

  addDraftArtifact(artifact: DraftArtifact): void {
    this.data.draftArtifacts.push(artifact);
    this.saveStore();
  }

  // RevisionRequest methods
  getRevisionRequests(grantId: string): RevisionRequest[] {
    return this.data.revisionRequests.filter((r) => r.grantId === grantId);
  }

  addRevisionRequest(request: RevisionRequest): void {
    this.data.revisionRequests.push(request);
    this.saveStore();
  }

  // ApprovalRecord methods
  getApprovalRecord(grantId: string): ApprovalRecord | null {
    return this.data.approvalRecords.find((r) => r.grantId === grantId) || null;
  }

  addApprovalRecord(record: ApprovalRecord): void {
    // Remove any existing approval record for this grant
    this.data.approvalRecords = this.data.approvalRecords.filter((r) => r.grantId !== record.grantId);
    this.data.approvalRecords.push(record);
    this.saveStore();
  }

  // SubmissionRecord methods
  getSubmissionRecord(grantId: string): SubmissionRecord | null {
    return this.data.submissionRecords.find((r) => r.grantId === grantId) || null;
  }

  addSubmissionRecord(record: SubmissionRecord): void {
    this.data.submissionRecords.push(record);
    this.saveStore();
  }

  // FollowUp methods
  getFollowUps(): FollowUp[] {
    return this.data.followUps;
  }

  addFollowUp(followUp: FollowUp): void {
    this.data.followUps.push(followUp);
    this.saveStore();
  }

  updateFollowUp(followUp: FollowUp): void {
    const index = this.data.followUps.findIndex((f) => f.id === followUp.id);
    if (index !== -1) {
      this.data.followUps[index] = followUp;
      this.saveStore();
    }
  }

  // OpencodeSettings methods
  getOpencodeSettings(): OpencodeSettings {
    return this.data.opencodeSettings;
  }

  updateOpencodeSettings(settings: OpencodeSettings): void {
    this.data.opencodeSettings = settings;
    this.saveStore();
    // Also save to shared persistence layer (GAP-01 fix)
    saveOpencodeSettings(settings, this.baseDir).catch((error) => {
      log.error('Error saving opencode settings to persistence:', error);
    });
  }
}

export const store = new Store();
