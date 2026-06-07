'use client';

import type { JSX } from 'react';
import React from 'react';
import type {
  CrawlStatus,
  Grant,
  JobQueueItem,
  Notification,
  OrganizationProfile,
} from '../../../shared/types';
import styles from './AppShell.module.css';
import {
  activityNav,
  handleNavClick,
  handleNavKeyDown,
  workspaceNav,
} from './sidebarNavigation';

export type SidebarView =
  | 'dashboard'
  | 'discovery'
  | 'pipeline'
  | 'sources'
  | 'calendar'
  | 'post-award'
  | 'tasks'
  | 'settings'
  | 'notifications'
  | 'jobs'
  | 'audit'
  | 'duplicates';

export interface AppShellSidebarProps {
  activeView: SidebarView;
  onNavigate: (view: SidebarView) => void;
  grants: Grant[];
  sourcesCount: number;
  notifications: Notification[];
  activeJobs: JobQueueItem[];
  pendingDuplicatesCount: number;
  operatorName: string;
  profile: OrganizationProfile | null;
  crawlStatus: CrawlStatus;
  isCrawlStale: boolean;
  getRelativeTime: (isoString: string) => string;
}

export function AppShellSidebar({
  activeView,
  onNavigate,
  grants,
  sourcesCount,
  notifications,
  activeJobs,
  pendingDuplicatesCount,
  operatorName,
  profile,
  crawlStatus,
  isCrawlStale,
  getRelativeTime,
}: AppShellSidebarProps): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark">
          Hacker Dojo <em>Grant Ops</em>
        </div>
        <div className="brand-sub">v0.2</div>
      </div>

      <div className="nav-section">
        <div className="nav-label">Workspace</div>
        {workspaceNav.map((item) => {
          const matchedCount =
            item.view === 'discovery'
              ? grants.filter((g) => g.status === 'matched').length
              : item.view === 'pipeline'
                ? grants.filter((g) => g.status !== 'awarded').length
                : item.view === 'sources'
                  ? sourcesCount
                  : 0;
          return (
            <button
              key={item.label}
              type="button"
              className={`nav-item ${activeView === item.view ? 'active' : ''}`}
              data-view={item.view}
              data-testid={item.view ? `nav-${item.view}` : undefined}
              aria-label={item.ariaLabel}
              aria-current={activeView === item.view ? 'page' : undefined}
              tabIndex={0}
              disabled={false}
              onClick={() => handleNavClick(item, onNavigate)}
              onKeyDown={(e) => handleNavKeyDown(e, item, onNavigate)}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
              {matchedCount > 0 && item.view && <span className="nav-count">{matchedCount}</span>}
            </button>
          );
        })}
      </div>

      <div className="nav-section">
        <div className="nav-label">Activity</div>
        {activityNav.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`nav-item ${activeView === item.view ? 'active' : ''}`}
            data-view={item.view}
            data-testid={item.view ? `nav-${item.view}` : undefined}
            aria-label={item.ariaLabel}
            aria-current={activeView === item.view ? 'page' : undefined}
            tabIndex={0}
            onClick={() => handleNavClick(item, onNavigate)}
            onKeyDown={(e) => handleNavKeyDown(e, item, onNavigate)}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
            {item.view === 'notifications' && notifications.length > 0 && (
              <span className="nav-count">{notifications.length}</span>
            )}
            {item.view === 'jobs' && activeJobs.length > 0 && (
              <span className="nav-count">{activeJobs.length}</span>
            )}
            {item.view === 'duplicates' && pendingDuplicatesCount > 0 && (
              <span className="nav-count">{pendingDuplicatesCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <span
          className={`status-dot ${crawlStatus.online ? '' : 'offline'}`}
          aria-hidden="true"
        />
        Crawler {crawlStatus.online ? 'online' : 'offline'}
        {isCrawlStale && <span className="staleness-badge">Stale</span>}
        <br />
        Last sync: {crawlStatus.lastSync ? getRelativeTime(crawlStatus.lastSync) : '\u2014'}
        <br />
        <br />
        {operatorName ? `Logged in as ${operatorName}` : 'Not logged in'}
        <br />
        <strong className={styles.mutedText}>
          {profile?.agentBehavior?.notifyEmail || 'ed@hackerdojo.com'}
        </strong>
      </div>
    </aside>
  );
}
