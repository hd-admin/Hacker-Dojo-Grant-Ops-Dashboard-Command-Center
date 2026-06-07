'use client';

import type { JSX } from 'react';
import React from 'react';
import type {
  Grant,
  Notification,
  OrganizationProfile,
  Source,
  Task,
} from '../../../shared/types';
import { AuditView } from './AuditView';
import { CalendarView } from './CalendarView';
import { DashboardView } from './DashboardView';
import { DiscoveryView } from './DiscoveryView';
import { DuplicatesView } from './DuplicatesView';
import { JobsPanel } from './JobsPanel';
import { NotificationsView } from './NotificationsView';
import { PipelineView } from './PipelineView';
import { PostAwardView } from './PostAwardView';
import { SettingsView } from './SettingsView';
import { SourcesView } from './SourcesView';
import { TasksView } from './TasksView';

export type AppShellActiveView =
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

export interface AppShellViewProps {
  activeView: AppShellActiveView;
  grants: Grant[];
  profile: OrganizationProfile | null;
  notifications: Notification[];
  sources: Source[];
  tasks: Task[];
  recentGrantIds: string[];
  operatorName: string;
  onGrantSelect: (grantId: string) => void;
  onNavigate: (view: AppShellActiveView) => void;
  refreshAppState: () => Promise<void>;
}

export function AppShellView({
  activeView,
  grants,
  profile,
  notifications,
  sources,
  tasks,
  recentGrantIds,
  operatorName,
  onGrantSelect,
  onNavigate,
  refreshAppState,
}: AppShellViewProps): JSX.Element {
  return (
    <>
      <div
        id="view-dashboard"
        className={`view ${activeView === 'dashboard' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Dashboard"
      >
        <DashboardView
          onGrantSelect={onGrantSelect}
          onNavigate={onNavigate}
          onRefreshAppState={refreshAppState}
          grants={grants}
          profile={profile}
          notifications={notifications}
          recentGrantIds={recentGrantIds}
          sources={sources}
          operatorName={operatorName}
        />
      </div>
      <div
        id="view-discovery"
        data-testid="discovery-view"
        className={`view ${activeView === 'discovery' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Discovery"
      >
        <DiscoveryView
          onGrantSelect={onGrantSelect}
          onRefreshAppState={refreshAppState}
          grants={grants}
          sources={sources}
        />
      </div>
      <div
        id="view-pipeline"
        data-testid="pipeline-view"
        className={`view ${activeView === 'pipeline' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Pipeline"
      >
        <PipelineView onGrantSelect={onGrantSelect} onNavigate={onNavigate} grants={grants} />
      </div>
      <div
        id="view-sources"
        className={`view ${activeView === 'sources' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Sources"
      >
        <SourcesView onRefreshAppState={refreshAppState} />
      </div>
      <div
        id="view-tasks"
        className={`view ${activeView === 'tasks' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Tasks"
      >
        <TasksView onRefreshAppState={refreshAppState} tasks={tasks} onNavigate={onNavigate} />
      </div>
      <div
        id="view-settings"
        className={`view ${activeView === 'settings' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Settings"
      >
        <SettingsView onRefreshAppState={refreshAppState} />
      </div>
      <div
        id="view-calendar"
        className={`view ${activeView === 'calendar' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Calendar"
      >
        <CalendarView grants={grants} />
      </div>
      <div
        id="view-post-award"
        data-testid="post-award-view"
        className={`view ${activeView === 'post-award' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Post-Award Management"
      >
        <PostAwardView onRefreshAppState={refreshAppState} />
      </div>
      <div
        id="view-notifications"
        className={`view ${activeView === 'notifications' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Notifications"
      >
        <NotificationsView notifications={notifications} />
      </div>
      <div
        id="view-jobs"
        className={`view ${activeView === 'jobs' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Job Queue"
      >
        <JobsPanel onRefreshAppState={refreshAppState} />
      </div>
      <div
        id="view-audit"
        className={`view ${activeView === 'audit' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Audit Trail"
      >
        <AuditView />
      </div>
      <div
        id="view-duplicates"
        className={`view ${activeView === 'duplicates' ? 'active' : ''}`}
        role="tabpanel"
        aria-label="Duplicate Candidates"
      >
        <DuplicatesView onGrantSelect={onGrantSelect} onRefreshAppState={refreshAppState} />
      </div>
    </>
  );
}
