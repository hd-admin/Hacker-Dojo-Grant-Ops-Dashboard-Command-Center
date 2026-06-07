'use client';

import type { JSX, ReactNode } from 'react';
import React from 'react';
import {
  Award,
  Bell,
  Calendar,
  Columns3,
  Database,
  FileText,
  GitFork,
  LayoutDashboard,
  ListChecks,
  Search,
  Settings,
} from 'lucide-react';
import type {
  CrawlStatus,
  Grant,
  JobQueueItem,
  Notification,
  OrganizationProfile,
} from '../../../shared/types';
import styles from './AppShell.module.css';

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

interface NavItem {
  view?: SidebarView;
  label: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

const workspaceNav: NavItem[] = [
  {
    view: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    ariaLabel: 'View dashboard',
  },
  {
    view: 'discovery',
    label: 'Discovery',
    icon: <Search size={18} />,
    ariaLabel: 'Discover grants',
  },
  {
    view: 'pipeline',
    label: 'Pipeline',
    icon: <Columns3 size={18} />,
    ariaLabel: 'View grant pipeline',
  },
  { view: 'sources', label: 'Sources', icon: <Database size={18} />, ariaLabel: 'Manage sources' },
  { view: 'calendar', label: 'Calendar', icon: <Calendar size={18} />, ariaLabel: 'View calendar' },
  {
    view: 'post-award',
    label: 'Post-Award',
    icon: <Award size={18} />,
    ariaLabel: 'View post-award management',
  },
  { view: 'tasks', label: 'Tasks', icon: <ListChecks size={18} />, ariaLabel: 'View tasks' },
  {
    view: 'settings',
    label: 'Settings',
    icon: <Settings size={18} />,
    ariaLabel: 'Application settings',
  },
];

const activityNav: NavItem[] = [
  {
    view: 'notifications',
    label: 'Notifications',
    icon: <Bell size={18} />,
    ariaLabel: 'View notifications',
  },
  { view: 'jobs', label: 'Jobs', icon: <Settings size={18} />, ariaLabel: 'View job queue' },
  { view: 'audit', label: 'Audit', icon: <FileText size={18} />, ariaLabel: 'View audit trail' },
  {
    view: 'duplicates',
    label: 'Duplicates',
    icon: <GitFork size={18} />,
    ariaLabel: 'Review duplicate candidates',
  },
];

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
  const handleNavClick = (item: NavItem): void => {
    if (item.view) {
      onNavigate(item.view);
    }
  };

  const handleNavKeyDown = (e: React.KeyboardEvent, item: NavItem): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (item.view) {
        onNavigate(item.view);
      }
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = e.currentTarget as HTMLElement;
      const sidebar = current.closest('.sidebar');
      if (!sidebar) return;
      const allNavItems = Array.from(sidebar.querySelectorAll<HTMLElement>('.nav-item'));
      const currentIndex = allNavItems.indexOf(current);
      if (currentIndex === -1) return;
      const nextIndex =
        e.key === 'ArrowDown'
          ? (currentIndex + 1) % allNavItems.length
          : (currentIndex - 1 + allNavItems.length) % allNavItems.length;
      allNavItems[nextIndex]?.focus();
    }
  };

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
              onClick={() => handleNavClick(item)}
              onKeyDown={(e) => handleNavKeyDown(e, item)}
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
            onClick={() => handleNavClick(item)}
            onKeyDown={(e) => handleNavKeyDown(e, item)}
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
