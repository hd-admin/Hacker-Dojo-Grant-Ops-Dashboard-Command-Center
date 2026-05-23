'use client';

import { useState, useEffect } from 'react';
import DashboardView from './DashboardView';
import DiscoveryView from './DiscoveryView';
import PipelineView from './PipelineView';
import SettingsView from './SettingsView';
import NotificationsView from './NotificationsView';
import TasksView from './TasksView';
import GrantDrawer from './GrantDrawer';
import type { Grant, OrganizationProfile, CrawlStatus } from '../../../shared/types';
import { client } from '../lib/grant-ops-client';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'settings' | 'notifications' | 'tasks';

interface NavItem {
  view?: ViewType;
  label: string;
  decorative?: boolean;
  icon?: string;
}

const workspaceNav: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', icon: '◐' },
  { view: 'discovery', label: 'Discovery', icon: '◇' },
  { view: 'pipeline', label: 'Pipeline', icon: '▤' },
  { view: 'settings', label: 'Settings', icon: '◯' },
];

const activityNav: NavItem[] = [
  { view: 'notifications', label: 'Notifications', icon: '✉' },
  { view: 'tasks', label: 'Tasks', icon: '⌖' },
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [appVersion] = useState('0.1.0');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus>({
    online: true,
    lastSync: '',
  });
  const [notifications, setNotifications] = useState<{ id: string }[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    async function loadInitialData() {
      try {
        const [grantsData, profileData, notificationsData] = await Promise.all([
          client.grants.getAll(),
          client.profile.get(),
          client.notifications.getAll(),
        ]);
        setGrants(grantsData);
        setProfile(profileData);
        setNotifications(notificationsData);

        // Get crawl runs to determine status
        const runsResponse = await client.research.getRuns();
        if (runsResponse.latestRun) {
          setCrawlStatus({
            online: runsResponse.latestRun.status === 'completed',
            lastSync: runsResponse.latestRun.completedAt || new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    }
    loadInitialData();
  }, []);

  const handleNavClick = (item: NavItem) => {
    if (item.view) {
      setActiveView(item.view);
    }
  };

  const handleNavigate = (view: ViewType) => {
    setActiveView(view);
  };

  const handleGrantSelect = (grantId: string) => {
    setSelectedGrantId(grantId);
  };

  const handleDrawerClose = () => {
    setSelectedGrantId(null);
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            Hacker Dojo <em>Grant Ops</em>
          </div>
          <div className="brand-sub">v{appVersion}</div>
        </div>

        <div className="nav-section">
          <div className="nav-label">Workspace</div>
          {workspaceNav.map((item) => {
            const matchedCount =
              item.view === 'discovery'
                ? grants.filter((g) => g.status === 'matched').length
                : item.view === 'pipeline'
                  ? grants.filter((g) => g.status !== 'awarded').length
                  : 0;
            return (
              <div
                key={item.label}
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                data-view={item.view}
                onClick={() => handleNavClick(item)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {matchedCount > 0 && item.view && <span className="nav-count">{matchedCount}</span>}
              </div>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-label">Activity</div>
          {activityNav.map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeView === item.view ? 'active' : ''}`}
              data-view={item.view}
              onClick={() => handleNavClick(item)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.view === 'notifications' && notifications.length > 0 && (
                <span className="nav-count">{notifications.length}</span>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className={`status-dot ${crawlStatus.online ? '' : 'offline'}`} />
          Crawler {crawlStatus.online ? 'online' : 'offline'}
          <br />
          Last sync: {isMounted && crawlStatus.lastSync ? getRelativeTime(crawlStatus.lastSync) : '—'}
          <br />
          <br />
          Logged in as
          <br />
          <strong style={{ color: 'var(--text-dim)' }}>
            {profile?.agentBehavior.notifyEmail || 'ed@hackerdojo.com'}
          </strong>
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        <div id="view-dashboard" className={`view ${activeView === 'dashboard' ? 'active' : ''}`}>
          <DashboardView onGrantSelect={handleGrantSelect} onNavigate={handleNavigate} />
        </div>
        <div id="view-discovery" className={`view ${activeView === 'discovery' ? 'active' : ''}`}>
          <DiscoveryView onGrantSelect={handleGrantSelect} />
        </div>
        <div id="view-pipeline" className={`view ${activeView === 'pipeline' ? 'active' : ''}`}>
          <PipelineView onGrantSelect={handleGrantSelect} onNavigate={handleNavigate} />
        </div>
        <div id="view-settings" className={`view ${activeView === 'settings' ? 'active' : ''}`}>
          <SettingsView />
        </div>
        <div
          id="view-notifications"
          className={`view ${activeView === 'notifications' ? 'active' : ''}`}
        >
          <NotificationsView />
        </div>
        <div id="view-tasks" className={`view ${activeView === 'tasks' ? 'active' : ''}`}>
          <TasksView />
        </div>
      </main>

      {/* Drawer */}
      <GrantDrawer grantId={selectedGrantId} onClose={handleDrawerClose} />
    </div>
  );
}

function getRelativeTime(isoString: string): string {
  const now = new Date();
  const date = new Date(isoString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
