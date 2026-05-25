'use client';

import React from 'react';
import type { Grant, OrganizationProfile, ActivityEvent, Notification } from '../../../shared/types';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'settings' | 'notifications' | 'tasks';

interface DashboardViewProps {
  onGrantSelect: (grantId: string) => void;
  onNavigate?: (view: ViewType) => void;
  onRefreshAppState?: () => Promise<void> | void;
  grants: Grant[];
  profile: OrganizationProfile | null;
  notifications?: Notification[];
}

function formatDate(dateStr: string): { day: string; month: string } {
  if (dateStr === 'Rolling') return { day: '—', month: '' };
  const parts = dateStr.split('-');
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return { day, month: months[parseInt(month, 10) - 1] ?? '' };
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount}`;
}

function getDefaultActivity(): ActivityEvent[] {
  return [
    {
      dot: 'success',
      text: '<strong>3 new grants</strong> matched from Candid weekly crawl',
      time: '2h ago',
    },
    {
      dot: 'accent',
      text: 'Draft completed for <strong>SVCF Community Innovation Fund</strong> · awaiting review',
      time: '4h ago',
    },
    {
      dot: 'info',
      text: 'Crawled 47 sources · 12 federal, 28 foundation, 7 corporate',
      time: '6h ago',
    },
    {
      dot: 'warning',
      text: 'NSF TechAccess LOI deadline in <strong>26 days</strong> — checklist 4/7 complete',
      time: 'yesterday',
    },
    {
      dot: 'success',
      text: 'Submitted: <strong>Wiener Family Foundation</strong> · confirmation #WFF-2026-0341',
      time: '2d ago',
    },
    { dot: 'accent', text: 'Org profile updated · Impact Report v2.1 indexed', time: '3d ago' },
  ];
}

export default function DashboardView({ onGrantSelect, onNavigate, onRefreshAppState, grants, profile, notifications }: DashboardViewProps) {
  const activity: ActivityEvent[] = (notifications && notifications.length > 0)
    ? notifications.slice(0, 6).map((n) => ({ dot: n.dot, text: n.text, time: n.time }))
    : getDefaultActivity();

  const handleRefreshCrawl = async () => {
    try {
      const response = await fetch('/api/research', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Failed to trigger research: ${response.status}`);
      }
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error triggering research:', error);
    }
  };

  const handleNewSearch = () => {
    onNavigate?.('discovery');
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const activeGrants = grants.filter((g) => g.status !== 'awarded');
  const activePipeline = activeGrants.reduce((sum, g) => sum + g.awardSort, 0);

  const deadlinesGrant = grants
    .filter((g) => g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)[0];

  const draftedReady = grants.filter((g) => g.status === 'review').length;

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newMatches7d = grants.filter((g) => {
    if (!g.matchedAt || g.status !== 'matched') return false;
    const matchedDate = new Date(g.matchedAt);
    return matchedDate >= sevenDaysAgo && matchedDate <= today;
  }).length;

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const grantsThisMonth = grants.filter((g) => {
    if (!g.matchedAt) return false;
    const matchedDate = new Date(g.matchedAt);
    return matchedDate >= firstOfMonth && matchedDate <= today;
  }).length;

  const highFitCount = grants.filter((g) => g.fit >= 85 && g.status === 'matched').length;

  const upcomingDeadlines = grants
    .filter((g) => g.daysOut < 90 && g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 5);

  const reviewQueue = grants.filter((g) => g.status === 'review');

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            {greeting},{' '}
            <span className="accent">{profile?.agentBehavior.notifyEmail.split('@')[0] ?? 'there'}</span>.
          </h1>
          <div className="header-sub">
            {dayName} · {dateStr} · {activeGrants.length} grants in pipeline
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleRefreshCrawl}>
            ↻ Refresh crawl
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
            {activeGrants.length} applications · <span className="delta-up">+{grantsThisMonth} this month</span>
          </div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Next Deadline</div>
          <div className="kpi-value">{deadlinesGrant ? `${deadlinesGrant.daysOut}d` : '—'}</div>
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
        {/* Deadlines Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Upcoming Deadlines</div>
            <button
              type="button"
              className="panel-action"
              data-view-link="pipeline"
              onClick={() => onNavigate?.('pipeline')}
            >
              View all
            </button>
          </div>
          <div className="deadline-list">
            {upcomingDeadlines.map((grant) => {
              const { day, month } = formatDate(grant.deadline);
              const urgency = grant.daysOut < 30 ? 'urgent' : grant.daysOut < 60 ? 'review' : 'draft';
              return (
                <button
                  type="button"
                  key={grant.id}
                  className="deadline-item"
                  onClick={() => onGrantSelect(grant.id)}
                >
                  <div className="deadline-date">
                    <div className="deadline-day">{day}</div>
                    <div className="deadline-month">{month}</div>
                  </div>
                  <div>
                    <div className="deadline-info-title">{grant.title}</div>
                    <div className="deadline-info-meta">
                      {grant.funder} · {grant.award}
                    </div>
                  </div>
                  <div className={`deadline-status ${urgency}`}>{grant.statusLabel}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Activity Panel */}
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

      {/* Review Queue */}
      {reviewQueue.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Awaiting Review</div>
            <button
              type="button"
              className="panel-action"
              data-view-link="pipeline"
              onClick={() => onNavigate?.('pipeline')}
            >
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
                  <div className="deadline-info-meta">
                    {grant.funder} · {grant.award} · Fit {grant.fit}
                  </div>
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
