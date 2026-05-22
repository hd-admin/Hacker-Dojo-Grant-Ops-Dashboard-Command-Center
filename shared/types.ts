// Grant status - GAP-02 FIX: 'discarded' is NOT a valid status
export type GrantStatus = 'matched' | 'draft' | 'review' | 'submitted' | 'awarded';

export interface FitScoreBreakdown {
  missionAlignment: number;
  geographicFocus: number;
  programTrackrecord: number;
  budgetCapacity: number;
  partnershipReadiness: number;
}

export interface ChecklistItem {
  label: string;
  done: boolean;
  source: string;
}

export interface Grant {
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

export interface OrganizationProfile {
  legalName: string;
  ein: string;
  samUEI: string;
  mission: string;
  docTypes: string[];
  searchThemes: string[];
  agentBehavior: {
    autoDraftThreshold: number;
    submissionPolicy: string;
    notifyEmail: string;
    voiceAndTone: string;
  };
}

export interface ActivityEvent {
  dot: string;
  text: string;
  time: string;
}

export interface BoardCard {
  id: string;
  title: string;
  funder: string;
  award: string;
  status: GrantStatus;
}

// ElectronAPI type exposed via contextBridge
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
}
