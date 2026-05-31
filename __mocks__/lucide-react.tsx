// Stub for lucide-react in test environments to avoid React context conflicts
import React from 'react';

function createIcon(name: string) {
  const Icon = ({ size: _size, ...props }: { size?: number; [key: string]: unknown }) =>
    React.createElement('span', { 'data-testid': `icon-${name}`, ...props });
  Icon.displayName = name;
  return Icon;
}

export const AlertTriangle = createIcon('AlertTriangle');
export const Award = createIcon('Award');
export const Bell = createIcon('Bell');
export const Calendar = createIcon('Calendar');
export const Check = createIcon('Check');
export const Columns3 = createIcon('Columns3');
export const Database = createIcon('Database');
export const FileText = createIcon('FileText');
export const GitFork = createIcon('GitFork');
export const LayoutDashboard = createIcon('LayoutDashboard');
export const ListChecks = createIcon('ListChecks');
export const Search = createIcon('Search');
export const Settings = createIcon('Settings');
export const UserCircle = createIcon('UserCircle');
export const X = createIcon('X');
export const ClipboardList = createIcon('ClipboardList');
export const MessageCircle = createIcon('MessageCircle');
export const Trash2 = createIcon('Trash2');
export const Edit = createIcon('Edit');
export const Plus = createIcon('Plus');
export const Minus = createIcon('Minus');
export const ChevronDown = createIcon('ChevronDown');
export const ChevronUp = createIcon('ChevronUp');
export const ChevronRight = createIcon('ChevronRight');
export const ChevronLeft = createIcon('ChevronLeft');
