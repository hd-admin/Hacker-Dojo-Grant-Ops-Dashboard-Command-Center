import type { GrantStatus, OrganizationProfile, CrawlStatus, Notification, Task, DocumentMetadata, ActivityEvent } from '../../shared/types';

export interface ElectronAPI {
  getGrants: () => Promise<Grant[]>;
  getGrantById: (id: string) => Promise<Grant | null>;
  updateGrantStatus: (id: string, status: GrantStatus) => Promise<void>;
  addGrant: (grant: Grant) => Promise<void>;
  getOrgProfile: () => Promise<OrganizationProfile>;
  updateOrgProfile: (profile: OrganizationProfile) => Promise<void>;
  getAppVersion: () => Promise<string>;
  quitApp: () => Promise<void>;
  onUpdateStatus: (callback: (status: string) => void) => void;
  // Crawl
  getCrawlStatus: () => Promise<CrawlStatus>;
  triggerCrawl: () => Promise<boolean>;
  // Notifications
  getNotifications: () => Promise<Notification[]>;
  updateNotifications: (notifications: Notification[]) => Promise<boolean>;
  // Tasks
  getTasks: () => Promise<Task[]>;
  updateTasks: (tasks: Task[]) => Promise<boolean>;
  // Documents
  uploadDocument: () => Promise<DocumentMetadata | null>;
  getDocuments: () => Promise<DocumentMetadata[]>;
  // Themes
  addTheme: (theme: string) => Promise<boolean>;
  removeTheme: (theme: string) => Promise<boolean>;
  // Activity
  getRecentActivity: (count: number) => Promise<ActivityEvent[]>;
}

interface Grant {
  id: string;
  title: string;
  funder: string;
  funderShort: string;
  award: string;
  awardSort: number;
  deadline: string;
  daysOut: number;
  fit: number;
  tags: string[];
  status: GrantStatus;
  statusLabel: string;
  matchedAt?: string;
  fitBreakdown?: FitScoreBreakdown;
  checklist?: ChecklistItem[];
  draftContent?: string;
  externalUrl?: string;
}

interface FitScoreBreakdown {
  missionAlignment: number;
  geographicFocus: number;
  programTrackrecord: number;
  budgetCapacity: number;
  partnershipReadiness: number;
}

interface ChecklistItem {
  label: string;
  done: boolean;
  source: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
