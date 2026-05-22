'use client';

import { useState, useEffect } from 'react';
import DashboardView from './DashboardView';
import DiscoveryView from './DiscoveryView';
import PipelineView from './PipelineView';
import SettingsView from './SettingsView';
import GrantDrawer from './GrantDrawer';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'settings';

interface NavItem {
  view?: ViewType;
  label: string;
  decorative?: boolean;
}

const workspaceNav: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'discovery', label: 'Discovery' },
  { view: 'pipeline', label: 'Pipeline' },
  { view: 'settings', label: 'Settings' },
];

const activityNav: NavItem[] = [
  { label: 'Notifications', decorative: true },
  { label: 'Tasks', decorative: true },
];

export default function AppShell() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('0.1.0');

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setAppVersion);
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
          {workspaceNav.map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeView === item.view ? 'active' : ''}`}
              data-view={item.view}
              onClick={() => handleNavClick(item)}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-label">Activity</div>
          {activityNav.map((item) => (
            <div
              key={item.label}
              className="nav-item"
              onClick={() => handleNavClick(item)}
            >
              {item.label}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div>
            <span className="status-dot" />
            Live
          </div>
          <div style={{ marginTop: 4 }}>Last crawl: 6h ago</div>
          <div style={{ marginTop: 8, color: 'var(--accent)' }}>ed@hackerdojo.com</div>
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
