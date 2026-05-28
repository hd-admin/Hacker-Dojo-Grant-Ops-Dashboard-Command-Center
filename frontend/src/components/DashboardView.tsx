'use client';

import React, { useEffect, useState } from 'react';
import type { Grant, OrganizationProfile, ActivityEvent, Notification, JobQueueItem } from '../../../shared/types';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'settings' | 'notifications' | 'tasks';

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

function getDefaultActivity(): ActivityEvent[] {
  return [
    { dot: 'success', text: '<strong>3 new grants</strong> matched from Candid weekly crawl', time: '2h ago' },
    { dot: 'accent', text: 'Draft completed for <strong>SVCF Community Innovation Fund</strong> \u00b7 awaiting review', time: '4h ago' },
    { dot: 'info', text: 'Crawled 47 sources \u00b7 12 federal, 28 foundation, 7 corporate', time: '6h ago' },
    { dot: 'warning', text: 'NSF TechAccess LOI deadline in <strong>26 days</strong> \u2014 checklist 4/7 complete', time: 'yesterday' },
    { dot: 'success', text: 'Submitted: <strong>Wiener Family Foundation</strong> \u00b7 confirmation #WFF-2026-0341', time: '2d ago' },
    { dot: 'accent', text: 'Org profile updated \u00b7 Impact Report v2.1 indexed', time: '3d ago' },
  ];
}

export default function DashboardView({ onGrantSelect, onNavigate, onRefreshAppState, grants, profile, notifications, recentGrantIds }: DashboardViewProps) {
  const [jobs, setJobs] = useState<JobQueueItem[]>([]);
  const activity: ActivityEvent[] = (notifications && notifications.length > 0)
    ? notifications.slice(0, 6).map((n) => ({ dot: n.dot, text: n.text, time: n.time }))
    : getDefaultActivity();

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
          <div className="empty-state-icon" aria-hidden="true">{'\u{1F4CB}'}</div>
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
          <div className="empty-state-icon" aria-hidden="true">{'\u{1F50D}'}</div>
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
          <div className="activity-list">
            {activity.map((item, idx) => (
              <div key={idx} className="activity-item">
                <div className={`activity-dot ${item.dot}`} />
                <div>
                  <div className="activity-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                  <div className="activity-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>
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
          <div className="activity-list">
            {jobs.slice(0, 8).map((job) => {
              const failureMessage = job.failureCategory === 'rate-limit'
                ? 'Service rate limited \u2014 wait before retrying'
                : job.failureCategory === 'quota-exhausted'
                ? 'Quota exhausted \u2014 action required to restore service'
                : job.failureCategory === 'timeout'
                ? 'Operation timed out \u2014 retry or check opencode settings'
                : job.failureCategory === 'capacity'
                ? 'Service temporarily unavailable \u2014 retry later'
                : job.failureCategory === 'connectivity'
                ? 'Cannot reach opencode \u2014 check path and settings in Org Profile'
                : '';
              return (
                <div key={job.id} className="activity-item">
                  <div>
                    <div className="activity-text"><strong>{job.jobType}</strong> \u00b7 {job.status}{job.failureCategory ? ` \u00b7 ${job.failureCategory}` : ''}</div>
                    <div className="activity-time">{job.stage ?? 'queued'} \u00b7 {job.lastUpdate ?? job.createdAt}</div>
                    {failureMessage && <div className="drawer-note">{failureMessage}</div>}
                    {job.errorMessage && <div className="drawer-note">{job.errorMessage}</div>}
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
