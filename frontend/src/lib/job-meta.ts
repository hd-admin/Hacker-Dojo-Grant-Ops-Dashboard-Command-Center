import {
  Ban,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  RotateCw,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { AgentTaskType, JobStatus } from '../../../shared/types';

export type JobStatusFilter = JobStatus | 'all';
export type JobTypeFilter = AgentTaskType | 'all';

/**
 * Status values offered in the queue's status filter. Intentionally a curated
 * subset of {@link JobStatus} — transient states (`verifying`, `retrying`) fold
 * into the broader buckets a user filters by.
 */
export const JOB_STATUS_FILTERS: JobStatusFilter[] = [
  'all',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
];

/** Every job type, in display order, for the type filter and counts. */
export const JOB_TYPE_FILTERS: JobTypeFilter[] = [
  'all',
  'research',
  'draft',
  'crawl',
  'match',
  'extract',
  'peer-discovery',
  'funder-insights',
  'eligibility-vetting',
  'budget-import',
];

const TYPE_LABELS: Record<AgentTaskType, string> = {
  research: 'Research',
  draft: 'Draft',
  crawl: 'Crawl',
  match: 'Match',
  extract: 'Extract',
  'peer-discovery': 'Peer Discovery',
  'funder-insights': 'Funder Insights',
  'eligibility-vetting': 'Eligibility Vetting',
  'budget-import': 'Budget Import',
};

export function jobTypeLabel(type: JobTypeFilter): string {
  if (type === 'all') return 'All';
  return TYPE_LABELS[type] ?? type;
}

export function jobStatusLabel(status: JobStatusFilter): string {
  if (status === 'all') return 'All';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Lucide icon for each job status. Replaces the old ad-hoc Unicode glyphs. */
const STATUS_ICON: Record<JobStatus, LucideIcon> = {
  queued: Clock,
  running: Loader2,
  verifying: CheckCheck,
  retrying: RotateCw,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
};

export function jobStatusIcon(status: JobStatus): LucideIcon {
  return STATUS_ICON[status] ?? Circle;
}

/** Active statuses whose icon should spin to signal in-flight work. */
export function jobStatusSpins(status: JobStatus): boolean {
  return status === 'running' || status === 'retrying' || status === 'verifying';
}

/**
 * Client-side progress mapping matching the server-side JobProgressStage values.
 * Kept here so both the queue list and any card renderer share one source.
 */
const STAGE_PROGRESS: Record<string, number> = {
  queued: 0,
  retrying: 5,
  preparing: 10,
  fetching: 30,
  analyzing: 60,
  drafting: 80,
  completed: 100,
  failed: 100,
  cancelled: 100,
};

export function getProgress(stage: string | undefined): number {
  return stage ? (STAGE_PROGRESS[stage] ?? 0) : 0;
}

export function stageDescription(stage: string | undefined): string {
  if (!stage || stage === 'queued') return 'Waiting to start';
  if (stage === 'retrying') return 'Retrying after previous attempt';
  if (stage === 'preparing') return 'Preparing resources';
  if (stage === 'fetching') return 'Fetching data';
  if (stage === 'analyzing') return 'Analyzing results';
  if (stage === 'drafting') return 'Generating draft';
  if (stage === 'completed') return 'Completed successfully';
  if (stage === 'failed') return 'Failed';
  if (stage === 'cancelled') return 'Cancelled';
  return stage;
}

export function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  } catch {
    return isoString;
  }
}
