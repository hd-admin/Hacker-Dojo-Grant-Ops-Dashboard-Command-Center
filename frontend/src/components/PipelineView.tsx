"use client";

import React from "react";
import { useEffect, useMemo, useState } from "react";
import type { Grant, GrantStatus, PipelineViewMode, ResponsibilityTag } from "../../../shared/types";
import { client } from "../lib/grant-ops-client";

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'sources' | 'settings' | 'notifications' | 'tasks';

type StatusFilter = 'All' | 'Matched' | 'Drafting' | 'Review' | 'Approved' | 'Submission Ready' | 'Submitted' | 'Follow-up' | 'Awarded' | 'Declined' | 'Closed' | 'Archived';
type UrgencyFilter = 'all' | 'overdue' | 'soon' | 'normal';
type FunderTypeFilter = 'all' | 'Foundation' | 'Government' | 'Corporate' | 'Community' | 'Other';

interface PipelineViewProps {
  onGrantSelect: (grantId: string) => void;
  onNavigate?: (view: ViewType) => void;
}

interface BoardColumn {
  key: GrantStatus;
  title: string;
}

const columns: BoardColumn[] = [
  { key: 'matched', title: 'Matched' },
  { key: 'draft', title: 'Drafting' },
  { key: 'review', title: 'Review' },
  { key: 'approved', title: 'Approved' },
  { key: 'submission-ready', title: 'Submission Ready' },
  { key: 'submitted', title: 'Submitted' },
  { key: 'follow-up', title: 'Follow-up' },
  { key: 'awarded', title: 'Awarded' },
  { key: 'declined', title: 'Declined' },
  { key: 'closed', title: 'Closed' },
  { key: 'archived', title: 'Archived' },
];

const WORKING_CONTEXT_KEY = 'grantops.workingContext';

function getWorkingContextStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  return typeof storage.getItem === 'function' && typeof storage.setItem === 'function' ? storage : null;
}

function readWorkingContext(): Record<string, unknown> {
  const storage = getWorkingContextStorage();
  if (!storage) return {};
  try {
    return JSON.parse(storage.getItem(WORKING_CONTEXT_KEY) || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function saveWorkingContextField(field: string, value: unknown): void {
  const storage = getWorkingContextStorage();
  if (!storage) return;
  const next = { ...readWorkingContext(), [field]: value };
  storage.setItem(WORKING_CONTEXT_KEY, JSON.stringify(next));
}

function formatDate(dateStr: string): string {
  if (dateStr === 'Rolling') return 'Rolling';
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(month, 10) - 1] ?? ''} ${parseInt(day, 10)}`;
}

function renderDeadlineCell(grant: Grant): React.ReactNode {
  const confidence = grant.deadlineConfidence;
  if (confidence === 'unknown') {
    return <span className="deadline-confidence deadline-confidence-unknown" title="Deadline confidence is unknown">Deadline unknown</span>;
  }
  if (confidence === 'rolling') {
    return <span className="deadline-confidence deadline-confidence-rolling" title="Rolling deadline — no fixed cutoff">Rolling</span>;
  }
  const dateStr = formatDate(grant.deadline);
  if (confidence === 'estimated') {
    return <span className="deadline-confidence deadline-confidence-estimated" title="Estimated from source date range">~{dateStr}</span>;
  }
  return <span className="deadline-confidence deadline-confidence-exact" title="Exact deadline from source">{dateStr}</span>;
}

function getUrgency(grant: Grant): UrgencyFilter {
  if (grant.daysOut < 0) return 'overdue';
  if (grant.daysOut <= 30) return 'soon';
  return 'normal';
}

function statusToLabel(status: GrantStatus): StatusFilter {
  switch (status) {
    case 'matched': return 'Matched';
    case 'draft': return 'Drafting';
    case 'review': return 'Review';
    case 'approved': return 'Approved';
    case 'submission-ready': return 'Submission Ready';
    case 'submitted': return 'Submitted';
    case 'follow-up': return 'Follow-up';
    case 'awarded': return 'Awarded';
    case 'declined': return 'Declined';
    case 'closed': return 'Closed';
    case 'archived': return 'Archived';
    default: return 'Matched';
  }
}

export default function PipelineView({ onGrantSelect, onNavigate }: PipelineViewProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<PipelineViewMode>('board');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [responsibilityFilter, setResponsibilityFilter] = useState<ResponsibilityTag | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [funderTypeFilter, setFunderTypeFilter] = useState<FunderTypeFilter>('all');

  useEffect(() => {
    const context = readWorkingContext();
    setViewMode((context.pipelineViewMode as PipelineViewMode) ?? 'board');
    setStatusFilter((context.pipelineStatusFilter as StatusFilter) ?? 'All');
    setResponsibilityFilter((context.pipelineResponsibilityFilter as ResponsibilityTag | 'all') ?? 'all');
    setUrgencyFilter((context.pipelineUrgencyFilter as UrgencyFilter) ?? 'all');
    setFunderTypeFilter((context.pipelineFunderTypeFilter as FunderTypeFilter) ?? 'all');
  }, []);

  useEffect(() => {
    saveWorkingContextField('pipelineViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    saveWorkingContextField('pipelineStatusFilter', statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    saveWorkingContextField('pipelineResponsibilityFilter', responsibilityFilter);
  }, [responsibilityFilter]);

  useEffect(() => {
    saveWorkingContextField('pipelineUrgencyFilter', urgencyFilter);
  }, [urgencyFilter]);

  useEffect(() => {
    saveWorkingContextField('pipelineFunderTypeFilter', funderTypeFilter);
  }, [funderTypeFilter]);

  const handleExportPipelineCsv = () => {
    const link = document.createElement('a');
    link.href = '/api/grants/export?view=pipeline';
    link.download = 'grant-ops-pipeline.csv';
    link.click();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleExportPipelineCsv();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await client.grants.getAll();
        setGrants(data);
      } catch (error) {
        console.error('Error loading grants:', error);
        setGrants([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredGrants = useMemo(() => {
    return grants.filter((grant) => {
      const statusMatches = statusFilter === 'All' || statusToLabel(grant.status) === statusFilter;
      const responsibilityMatches = responsibilityFilter === 'all' || grant.responsibilityTag === responsibilityFilter;
      const urgencyMatches = urgencyFilter === 'all' || getUrgency(grant) === urgencyFilter;
      const funderTypeMatches = funderTypeFilter === 'all' || grant.tags.includes(funderTypeFilter);
      return statusMatches && responsibilityMatches && urgencyMatches && funderTypeMatches;
    });
  }, [grants, statusFilter, responsibilityFilter, urgencyFilter, funderTypeFilter]);

  if (loading) {
    return (
      <div className="spinner-overlay" role="status" aria-busy="true" aria-label="Loading pipeline">
        <div className="spinner" />
      </div>
    );
  }

  const boardCounts = new Map(columns.map((column) => [column.key, 0]));
  for (const grant of filteredGrants) {
    boardCounts.set(grant.status, (boardCounts.get(grant.status) ?? 0) + 1);
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Pipeline <span className="accent">Grant board</span>
          </h1>
          <div className="header-sub">{filteredGrants.length} active grants</div>
        </div>
        <div className="header-actions">
          <button type="button" data-testid="pipeline-view-mode-toggle" onClick={() => setViewMode((current) => current === 'board' ? 'list' : 'board')}>
            {viewMode === 'board' ? 'Switch to list' : 'Switch to board'}
          </button>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="All">Filter: All</option>
            {['Matched','Drafting','Review','Approved','Submission Ready','Submitted','Follow-up','Awarded','Declined','Closed','Archived'].map((label) => <option key={label} value={label}>{label}</option>)}
          </select>
          <select data-testid="pipeline-responsibility-filter" value={responsibilityFilter} onChange={(e) => setResponsibilityFilter(e.target.value as ResponsibilityTag | 'all')}>
            <option value="all">All responsibilities</option>
            <option value="finance">Finance</option>
            <option value="program">Program</option>
            <option value="review">Review</option>
            <option value="follow-up">Follow-up</option>
          </select>
          <select data-testid="pipeline-urgency-filter" value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value as UrgencyFilter)}>
            <option value="all">All urgency</option>
            <option value="overdue">Overdue</option>
            <option value="soon">Soon</option>
            <option value="normal">Normal</option>
          </select>
          <select data-testid="pipeline-funder-type-filter" value={funderTypeFilter} onChange={(e) => setFunderTypeFilter(e.target.value as FunderTypeFilter)}>
            <option value="all">All funder types</option>
            <option value="Foundation">Foundation</option>
            <option value="Government">Government</option>
            <option value="Corporate">Corporate</option>
            <option value="Community">Community</option>
            <option value="Other">Other</option>
          </select>
          <button
            type="button"
            className="btn"
            onClick={handleExportPipelineCsv}
            aria-label="Export pipeline as CSV"
          >
            Export CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('discovery')}>+ Add to pipeline</button>
        </div>
      </div>

      {grants.length === 0 && (
        <div className="empty-state-guide" data-testid="pipeline-empty-state">
          <div className="empty-state-icon" aria-hidden="true">{String.fromCodePoint(0x1F4CB)}</div>
          <div className="empty-state-title">Your pipeline is empty</div>
          <div className="empty-state-description">
            Grants move through your pipeline from discovery to submission.
            Start by discovering grants in the Discovery view and add them to your pipeline.
          </div>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('discovery')} aria-label="Go to discovery">
              Discover grants
            </button>
            <button type="button" className="btn" onClick={() => onNavigate?.('sources')} aria-label="Manage sources">
              Manage sources
            </button>
          </div>
        </div>
      )}

      {viewMode === 'list' ? (
        <div data-testid="pipeline-list-view" className="pipeline-list-view">
          <div className="pipeline-list-header">
            <div>Grant Title</div>
            <div>Funder</div>
            <div>Status</div>
            <div>Deadline</div>
            <div>Award</div>
            <div>Responsibility</div>
          </div>
          {filteredGrants.map((grant) => (
            <button key={grant.id} type="button" className="pipeline-list-row" onClick={() => onGrantSelect(grant.id)}>
              <div>{grant.title}</div>
              <div>{grant.funder}</div>
              <div>{statusToLabel(grant.status)}</div>
              <div>{renderDeadlineCell(grant)}</div>
              <div>{grant.award}</div>
              <div>{grant.responsibilityTag ?? '—'}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="board">
          {columns.map((col) => {
            const colGrants = filteredGrants.filter((grant) => grant.status === col.key);
            return (
              <section key={col.key} className="board-col">
                <div className="board-col-header">
                  <div className="board-col-title">{col.title.toUpperCase()}</div>
                  <div className="board-col-count">{boardCounts.get(col.key) ?? 0}</div>
                </div>
                <div className="board-col-body">
                  {colGrants.length === 0 ? (
                    <div className="empty">none</div>
                  ) : (
                    colGrants.map((grant) => (
                      <button key={grant.id} type="button" className="board-card" onClick={() => onGrantSelect(grant.id)}>
                        <div className="board-card-funder">{grant.funderShort}</div>
                        <div className="board-card-title">{grant.title}</div>
                        <div className="board-card-foot">
                          <span>{renderDeadlineCell(grant)}</span>
                          <span className="amount">{grant.award}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
