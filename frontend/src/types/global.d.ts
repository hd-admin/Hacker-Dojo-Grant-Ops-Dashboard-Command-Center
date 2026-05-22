import type { GrantStatus } from '../../shared/types';

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

interface OrganizationProfile {
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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
