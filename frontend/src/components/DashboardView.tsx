'use client';

import { useState, useEffect } from 'react';
import type { Grant, OrganizationProfile } from '../../../shared/types';

interface DashboardViewProps {
  onGrantSelect: (grantId: string) => void;
}

const TODAY = '2026-05-21';

const activity = [
  { dot: 'success', text: '<strong>3 new grants</strong> matched from Candid weekly crawl', time: '2h ago' },
  { dot: 'accent', text: 'Draft completed for <strong>SVCF Community Innovation Fund</strong> · awaiting review', time: '4h ago' },
  { dot: 'info', text: 'Crawled 47 sources · 12 federal, 28 foundation, 7 corporate', time: '6h ago' },
  { dot: 'warning', text: 'NSF TechAccess LOI deadline in <strong>26 days</strong> — checklist 4/7 complete', time: 'yesterday' },
  { dot: 'success', text: 'Submitted: <strong>Wiener Family Foundation</strong> · confirmation #WFF-2026-0341', time: '2d ago' },
  { dot: 'accent', text: 'Org profile updated · Impact Report v2.1 indexed', time: '3d ago' },
];

function formatDate(dateStr: string): { day: string; month: string } {
  if (dateStr === 'Rolling') return { day: '—', month: '' };
  const parts = dateStr.split('-');
  const year = parts[0] ?? '';
  const month = parts[1] ?? '';
  const day = parts[2] ?? '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

export default function DashboardView({ onGrantSelect }: DashboardViewProps) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [grantsData, profileData] = await Promise.all([
          window.electronAPI.getGrants(),
          window.electronAPI.getOrgProfile(),
        ]);
        setGrants(grantsData);
        setProfile(profileData);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="header-title">Loading...</div>;
  }

  // Dynamic time-of-day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // KPI calculations
  const activeGrants = grants.filter((g) => g.status !== 'awarded');
  const activePipeline = activeGrants.reduce((sum, g) => sum + g.awardSort, 0);

  const deadlinesGrant = grants
    .filter((g) => g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)[0];

  const draftedReady = grants.filter((g) => g.status === 'review').length;

  // GAP-06: New Matches 7d - grants with matchedAt within 7 days of TODAY
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newMatches7d = grants.filter((g) => {
    if (!g.matchedAt || g.status !== 'matched') return false;
    const matchedDate = new Date(g.matchedAt);
    return matchedDate >= sevenDaysAgo && matchedDate <= today;
  }).length;

  // Upcoming deadlines (next 90 days, not rolling)
  const upcomingDeadlines = grants
    .filter((g) => g.daysOut < 90 && g.daysOut > 0 && g.deadline !== 'Rolling')
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 5);

  // Review queue
  const reviewQueue = grants.filter((g) => g.status === 'review');

  // Header sub text
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            {greeting}, <span className="accent">Qi</span>.
          </h1>
          <div className="header-sub">{dayName} · {dateStr} · {activeGrants.length} grants in pipeline</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-ghost btn-sm">↻ Refresh crawl</button>
          <button className="btn btn-primary">+ New search</button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Active Pipeline</div>
          <div className="kpi-value">{formatCurrency(activePipeline)}</div>
          <div className="kpi-meta">{activeGrants.length} grants tracked</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Next Deadline</div>
          <div className="kpi-value">
            {deadlinesGrant ? `${deadlinesGrant.daysOut}d` : '—'}
          </div>
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
          <div className="kpi-meta">matched this week</div>
        </div>
      </div>

      {/* Panel Grid */}
      <div className="panel-grid">
        {/* Deadlines Panel */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Upcoming Deadlines</div>
            <div className="panel-action">View all</div>
          </div>
          <div className="deadline-list">
            {upcomingDeadlines.map((grant) => {
              const { day, month } = formatDate(grant.deadline);
              const urgency =
                grant.daysOut < 30 ? 'urgent' : grant.daysOut < 60 ? 'review' : 'draft';
              return (
                <div
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
                </div>
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
                  <div
                    className="activity-text"
                    dangerouslySetInnerHTML={{ __html: item.text }}
                  />
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
            <div className="panel-action">{reviewQueue.length} drafts</div>
          </div>
          {reviewQueue.map((grant) => {
            const { day, month } = formatDate(grant.deadline);
            return (
              <div
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
                    {grant.funder} · {grant.award} · Fit {grant.fit}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGrantSelect(grant.id);
                  }}
                >
                  Review draft
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
