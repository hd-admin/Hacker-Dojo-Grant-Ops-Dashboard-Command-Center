'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardList, MessageCircle, Search } from 'lucide-react';
import type { FollowUp, Grant, OrganizationProfile, ActivityEvent, Notification, JobQueueItem } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';
import { jobFailureMessages } from '../lib/failure-messages';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'sources' | 'settings' | 'notifications' | 'tasks';

interface DashboardViewProps {
  onGrantSelect: (grantId: string) => void;
  onNavigate?: (view: ViewType) => void;
  onRefreshAppState?: () => Promise<void> | void;
  grants: Grant[];
  profile: OrganizationProfile | null;
  notifications?: Notification[];
  recentGrantIds?: string[];
}

function formatDate(dateStr: string): { day: string; month: string } {
  if (dateStr === 'Rolling') return { day: '\u2014', month: '' };
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return { day, month: months[parseInt(month, 10) - 1] ?? '' };
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

/** Client-side progress mapping matching the server-side JobProgressStage values. */
const stageProgress: Record<string, number> = {
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

function getJobProgress(stage: string | undefined): number {
  return stage ? (stageProgress[stage] ?? 0) : 0;
}

function stageDescription(stage: string | undefined): string {
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

export default function DashboardView({ onGrantSelect, onNavigate, onRefreshAppState, grants, profile, notifications, recentGrantIds }: DashboardViewProps) {
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const activity: ActivityEvent[] = (notifications && notifications.length > 0)
    ? notifications.slice(0, 6).map((n) => ({ dot: n.dot, text: n.text, time: n.time }))
    : [];

  const handleRefreshCrawl = async () => {
    try {
      const response = await fetch('/api/research', { method: 'POST' });
      if (!response.ok) throw new Error(`Failed to trigger research: ${response.status}`);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error triggering research:', error);
    }
  };

  const handleNewSearch = () => { onNavigate?.('discovery'); };

  useEffect(() => {
    let cancelled = false;
    const loadJobs = async () => {
      try {
        const response = await fetch('/api/jobs');
        const data = (await response.json()) as JobQueueItem[];
        if (!cancelled) setJobs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading jobs:', error);
        if (!cancelled) setJobs([]);
      }
    };
    void loadJobs();
    const interval = window.setInterval(() => {
      void loadJobs();
    }, jobs.some((job) => job.status === 'queued' || job.status === 'running') ? 5000 : 15000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [jobs]);

  useEffect(() => {
    let cancelled = false;
    const loadFollowUps = async () => {
      try {
        const data = await client.followUps.getAll();
        if (!cancelled) setFollowUps(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error loading follow-ups:', error);
        if (!cancelled) setFollowUps([]);
      }
    };
    void loadFollowUps();
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeGrants = grants.filter((g) => g.status !== 'awarded');
  const activePipeline = activeGrants.reduce((sum, g) => sum + g.awardSort, 0);

  const deadlinesGrant = grants
    .filter((g) => g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)[0];

  const draftedReady = grants.filter((g) => g.status === 'review').length;

  const today = new Date();
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newMatches7d = grants.filter((g) => {
    if (!g.matchedAt || g.status !== 'matched') return false;
    return new Date(g.matchedAt) >= sevenDaysAgo;
  }).length;

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const grantsThisMonth = grants.filter((g) => {
    if (!g.matchedAt) return false;
    return new Date(g.matchedAt) >= firstOfMonth;
  }).length;

  const highFitCount = grants.filter((g) => g.fit >= 85 && g.status === 'matched').length;

  const upcomingDeadlines = grants
    .filter((g) => g.daysOut < 90 && g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 5);

  const reviewQueue = grants.filter((g) => g.status === 'review');

  // Follow-up data
  const _pendingFollowUps = followUps.filter((f) => f.status === 'pending');
  const _overdueFollowUps = followUps.filter((f) => {
    if (f.status !== 'pending' || !f.dueDate) return false;
    return new Date(f.dueDate) < new Date();
  });
  const _upcomingFollowUps = followUps.filter((f) => {
    if (f.status !== 'pending' || !f.dueDate) return false;
    const dueDate = new Date(f.dueDate);
    return dueDate >= new Date() && dueDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  });
  const followUpActivityItems = followUps
    .filter((f) => f.status === 'completed' && f.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
    .slice(0, 3)
    .map((f) => {
      const grant = grants.find((g) => g.id === f.grantId);
      return {
        dot: 'success' as const,
        text: `Follow-up completed: <strong>${f.title}</strong>${grant ? ` for ${grant.title}` : ''}`,
        time: new Date(f.completedAt!).toLocaleString(),
      };
    });
  // Merge follow-up activity into general activity feed
  const mergedActivity = [...followUpActivityItems, ...activity].slice(0, 6);

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Empty state: no grants and no profile
  if (grants.length === 0 && !profile?.legalName) {
    return (
      <>
        <div className="header">
          <div>
            <h1 className="header-title">
              {greeting},{' '}
              <span className="accent">Welcome</span>.
            </h1>
            <div className="header-sub">{dayName} \u00b7 {dateStr}</div>
          </div>
        </div>
        <div className="empty-state-guide" data-testid="dashboard-empty-state">
          <div className="empty-state-icon" aria-hidden="true"><ClipboardList size={48} /></div>
          <div className="empty-state-title">Get started with Grant Ops</div>
          <div className="empty-state-description">
            Add your first grant source to discover funding opportunities,
            or complete your organization profile to enable AI-powered grant matching and drafting.
          </div>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('sources')} aria-label="Add your first grant source">
              Add a source
            </button>
            <button type="button" className="btn" onClick={() => onNavigate?.('settings')} aria-label="Complete organization profile">
              Complete profile
            </button>
          </div>
        </div>
      </>
    );
  }

  // Minimal state: profile exists but no grants
  if (grants.length === 0) {
    return (
      <>
        <div className="header">
          <div>
            <h1 className="header-title">
              {greeting},{' '}
              <span className="accent">{profile?.agentBehavior.notifyEmail.split('@')[0] ?? 'there'}</span>.
            </h1>
            <div className="header-sub">{dayName} \u00b7 {dateStr} \u00b7 Ready to discover grants</div>
          </div>
          <div className="header-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('sources')}>+ Add a source</button>
            <button type="button" className="btn" onClick={() => onNavigate?.('discovery')}>Browse discovery</button>
          </div>
        </div>
        <div className="empty-state-guide" data-testid="dashboard-empty-grants">
          <div className="empty-state-icon" aria-hidden="true"><Search size={48} /></div>
          <div className="empty-state-title">No grants discovered yet</div>
          <div className="empty-state-description">
            Add funding sources and run discovery to find grants that match your organization.
            The AI will crawl your sources and surface the best matches.
          </div>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('sources')} aria-label="Add grant sources">Add sources</button>
            <button type="button" className="btn" onClick={() => onNavigate?.('discovery')} aria-label="Browse discovery">Open discovery</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            {greeting},{' '}
            <span className="accent">{profile?.agentBehavior.notifyEmail.split('@')[0] ?? 'there'}</span>.
          </h1>
          <div className="header-sub">
            {dayName} \u00b7 {dateStr} \u00b7 {activeGrants.length} grants in pipeline
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleRefreshCrawl}>
            {'\u21BB'} Refresh crawl
          </button>
          <button type="button" className="btn btn-primary" onClick={handleNewSearch}>
            + New search
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Active Pipeline</div>
          <div className="kpi-value">{formatCurrency(activePipeline)}</div>
          <div className="kpi-meta">
            {activeGrants.length} applications \u00b7 <span className="delta-up">+{grantsThisMonth} this month</span>
          </div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Next Deadline</div>
          <div className="kpi-value">{deadlinesGrant ? `${deadlinesGrant.daysOut}d` : '\u2014'}</div>
          <div className="kpi-meta">
            {deadlinesGrant?.title.substring(0, 30) || 'No upcoming deadline'}
            {deadlinesGrant && deadlinesGrant.title.length > 30 ? '...' : ''}
          </div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">Drafted &amp; Ready</div>
          <div className="kpi-value">{draftedReady}</div>
          <div className="kpi-meta">awaiting your review</div>
        </div>
        <div className="kpi-card info">
          <div className="kpi-label">New Matches 7d</div>
          <div className="kpi-value">{newMatches7d}</div>
          <div className="kpi-meta">{highFitCount} high-fit (&gt; 85)</div>
        </div>
      </div>

      {/* Panel Grid */}
      <div className="panel-grid">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Upcoming Deadlines</div>
            <button type="button" className="panel-action" data-view-link="pipeline" onClick={() => onNavigate?.('pipeline')}>
              View all
            </button>
          </div>
          <div className="deadline-list">
            {upcomingDeadlines.map((grant) => {
              const { day, month } = formatDate(grant.deadline);
              const urgency = grant.daysOut < 30 ? 'urgent' : grant.daysOut < 60 ? 'review' : 'draft';
              return (
                <button type="button" key={grant.id} className="deadline-item" onClick={() => onGrantSelect(grant.id)}>
                  <div className="deadline-date">
                    <div className="deadline-day">{day}</div>
                    <div className="deadline-month">{month}</div>
                  </div>
                  <div>
                    <div className="deadline-info-title">{grant.title}</div>
                    <div className="deadline-info-meta">{grant.funder} \u00b7 {grant.award}</div>
                  </div>
                  <div className={`deadline-status ${urgency}`}>{grant.statusLabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Agent Activity</div>
          </div>
          {mergedActivity.length > 0 ? (
            <div className="activity-list">
              {mergedActivity.map((item, idx) => (
                <div key={idx} className="activity-item">
                  <div className={`activity-dot ${item.dot}`} />
                  <div>
                    <div className="activity-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                    <div className="activity-time">{item.time}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-guide" data-testid="activity-empty-state">
              <div className="empty-state-icon" aria-hidden="true"><MessageCircle size={48} /></div>
              <div className="empty-state-title">No activity yet</div>
              <div className="empty-state-description">
                Activity will appear here as the system processes grants, generates drafts, and surfaces new matches.
              </div>
            </div>
          )}
        </div>
      </div>

      {recentGrantIds && recentGrantIds.length > 0 && (
        <div className="panel" data-testid="recent-grants-widget">
          <div className="panel-header">
            <div className="panel-title">Recently Viewed</div>
          </div>
          <div className="activity-list">
            {recentGrantIds.map((grantId) => {
              const grant = grants.find((item) => item.id === grantId);
              if (!grant) return null;
              return (
                <button key={grant.id} type="button" className="deadline-item" onClick={() => onGrantSelect(grant.id)}>
                  <div>
                    <div className="deadline-info-title">{grant.title}</div>
                    <div className="deadline-info-meta">{grant.funder} \u00b7 {grant.statusLabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="panel" data-testid="job-queue-widget">
          <div className="panel-header">
            <div className="panel-title">Job Queue</div>
          </div>
          {/* ARIA live region for job state announcements */}
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
            data-testid="dashboard-jobs-aria-live"
          >
            {jobs.filter((j) => j.status === 'queued' || j.status === 'running').length} active job(s)
          </div>
          <div className="activity-list">
            {jobs.slice(0, 8).map((job) => {
              const progress = getJobProgress(job.stage);
              const isRunning = job.status === 'running';
              const failureMsg =
                job.failureCategory && job.status === 'failed'
                  ? jobFailureMessages[job.failureCategory]
                  : null;
              return (
                <div key={job.id} className="activity-item">
                  <div>
                    <div className="activity-text">
                      <strong>{job.jobType}</strong> \u00b7 {job.status}
                      {job.failureCategory ? ` \u00b7 ${job.failureCategory}` : ''}
                    </div>
                    {/* Stage description */}
                    <div className="activity-time">
                      {stageDescription(job.stage)}
                    </div>
                    {/* Progress bar */}
                    <div
                      className="job-progress-container"
                      data-testid={`dashboard-job-progress-${job.id}`}
                    >
                      <div
                        className={`job-progress-bar ${isRunning ? 'indeterminate' : ''}`}
                        role="progressbar"
                        aria-valuenow={isRunning ? undefined : progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Job progress: ${job.stage ?? 'unknown'}`}
                        style={isRunning ? undefined : { width: `${progress}%` }}
                      />
                    </div>
                    {/* Timestamps */}
                    <div className="activity-time">
                      {job.lastUpdate
                        ? `Updated: ${new Date(job.lastUpdate).toLocaleTimeString()}`
                        : `Created: ${new Date(job.createdAt).toLocaleTimeString()}`}
                    </div>
                    {/* Failure guidance from failure-messages.ts */}
                    {failureMsg && (
                      <div
                        className="failure-guidance failure-guidance-compact"
                        data-testid={`dashboard-job-failure-${job.id}`}
                      >
                        <span className="failure-guidance-title">{failureMsg.title}</span>
                        {' \u2014 '}
                        <span className="failure-guidance-action">{failureMsg.action}</span>
                      </div>
                    )}
                    {job.errorMessage && (
                      <div className="drawer-note" data-testid={`dashboard-job-error-${job.id}`}>
                        {job.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviewQueue.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Awaiting Review</div>
            <button type="button" className="panel-action" data-view-link="pipeline" onClick={() => onNavigate?.('pipeline')}>
              {reviewQueue.length} drafts
            </button>
          </div>
          {reviewQueue.map((grant) => {
            const { day, month } = formatDate(grant.deadline);
            return (
              <button type="button" key={grant.id} className="deadline-item" onClick={() => onGrantSelect(grant.id)}>
                <div className="deadline-date">
                  <div className="deadline-day">{day}</div>
                  <div className="deadline-month">{month}</div>
                </div>
                <div>
                  <div className="deadline-info-title">{grant.title}</div>
                  <div className="deadline-info-meta">{grant.funder} \u00b7 {grant.award} \u00b7 Fit {grant.fit}</div>
                </div>
                <span className="btn btn-sm btn-primary">Review draft</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
