'use client';

import type { ReactNode } from 'react';
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
import type { SidebarView } from './AppShellSidebar';

export interface NavItem {
  view?: SidebarView;
  label: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

export const workspaceNav: NavItem[] = [
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

export const activityNav: NavItem[] = [
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

export function handleNavClick(item: NavItem, onNavigate: (view: SidebarView) => void): void {
  if (item.view) {
    onNavigate(item.view);
  }
}

export function handleNavKeyDown(
  e: React.KeyboardEvent,
  item: NavItem,
  onNavigate: (view: SidebarView) => void,
): void {
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
}
