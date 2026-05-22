'use client';

import { useState, useEffect } from 'react';
import DashboardView from './DashboardView';
import DiscoveryView from './DiscoveryView';
import PipelineView from './PipelineView';
import SettingsView from './SettingsView';
import GrantDrawer from './GrantDrawer';
import type { Grant } from '../../../shared/types';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'settings';

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
  { label: 'Notifications', decorative: true, icon: '✉' },
  { label: 'Tasks', decorative: true, icon: '⌖' },
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('0.1.0');
  const [grants, setGrants] = useState<Grant[]>([]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
      window.electronAPI.getGrants().then(setGrants);
    }
  }, []);

  const handleNavClick = (item: NavItem) => {
    if (item.decorative) {
      console.log(`${item.label} not implemented in v1`);
      return;
    }
    if (item.view) {
      setActiveView(item.view);
    }
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
            const matchedCount = item.view === 'discovery'
              ? grants.filter(g => g.status === 'matched').length
              : item.view === 'pipeline'
              ? grants.filter(g => g.status !== 'awarded').length
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
                {matchedCount > 0 && item.view && (
                  <span className="nav-count">{matchedCount}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="nav-section">
          <div className="nav-label">Activity</div>
          {activityNav.map((item) => (
            <div
              key={item.label}
              className="nav-item"
              onClick={() => handleNavClick(item)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.decorative && item.icon === '✉' && grants.filter(g => g.status === 'review').length > 0 && (
                <span className="nav-count">{grants.filter(g => g.status === 'review').length}</span>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />Crawler online<br/>
          Last sync: 2h ago<br/>
          <br/>
          Logged in as<br/>
          <strong style={{color:'var(--text-dim)'}}>ed@hackerdojo.com</strong>
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        <div id="view-dashboard" className={`view ${activeView === 'dashboard' ? 'active' : ''}`}>
          <DashboardView onGrantSelect={handleGrantSelect} />
        </div>
        <div id="view-discovery" className={`view ${activeView === 'discovery' ? 'active' : ''}`}>
          <DiscoveryView onGrantSelect={handleGrantSelect} />
        </div>
        <div id="view-pipeline" className={`view ${activeView === 'pipeline' ? 'active' : ''}`}>
          <PipelineView onGrantSelect={handleGrantSelect} />
        </div>
        <div id="view-settings" className={`view ${activeView === 'settings' ? 'active' : ''}`}>
          <SettingsView />
        </div>
      </main>

      {/* Drawer */}
      <GrantDrawer grantId={selectedGrantId} onClose={handleDrawerClose} />
    </div>
  );
}
