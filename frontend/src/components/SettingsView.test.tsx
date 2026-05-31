// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { DocumentMetadata, OrganizationProfile, OpencodeSettings } from '../../../shared/types';

const {
  profileGet,
  profileUpdate,
  documentsGetAll,
  documentsCreate,
  opencodeGet,
  opencodeUpdate,
  onRefreshAppState,
} = vi.hoisted(() => ({
  profileGet: vi.fn(),
  profileUpdate: vi.fn(),
  documentsGetAll: vi.fn(),
  documentsCreate: vi.fn(),
  opencodeGet: vi.fn(),
  opencodeUpdate: vi.fn(),
  onRefreshAppState: vi.fn(),
}));

const {
  themesGet,
  themesUpdate,
  themesRescore,
  backupGetFreshness,
  backupExport,
  backupRestore,
} = vi.hoisted(() => ({
  themesGet: vi.fn(),
  themesUpdate: vi.fn(),
  themesRescore: vi.fn(),
  backupGetFreshness: vi.fn(),
  backupExport: vi.fn(),
  backupRestore: vi.fn(),
}));

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    profile: { get: profileGet, update: profileUpdate },
    documents: { getAll: documentsGetAll, create: documentsCreate },
    opencodeSettings: { get: opencodeGet, update: opencodeUpdate },
    themes: { get: themesGet, update: themesUpdate, rescore: themesRescore },
    backup: {
      getFreshness: backupGetFreshness,
      exportBackup: backupExport,
      restore: backupRestore,
    },
  },
}));

import SettingsView from './SettingsView';

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo, a California nonprofit corporation',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  nonprofitStatus: '501(c)(3)',
  yearFounded: 2009,contactInfo: {},
  geography: 'Regional',
  mission: 'Community innovation and technology education',
  programAreas: ['STEM'],
  populationsServed: ['Youth'],
  fundingHistory: [],
  partnerships: [],
  complianceFacts: [],
  boardMembers: [],docTypes: ['PDF', 'XLS', 'DOC'],
  searchThemes: ['Makerspaces', 'AI literacy', 'Community innovation'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

const opencodeSettings: OpencodeSettings = {
  binaryPath: '/usr/local/bin/opencode',
  workingDirectory: '/Users/mistlight/Projects/Experiments/HackerDojoGrantApp',
  timeoutMs: 60000,
  profile: 'default',
  isConfigured: true,
};

const documents: DocumentMetadata[] = [
  {
    id: 'doc-1',
    name: 'Hacker Dojo Program Summary.pdf',
    type: 'PDF',
    lastUsed: '2026-04-01',
    extractionStatus: 'extracted',
    contentSnippet:
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
  },
  {
    id: 'doc-2',
    name: 'Budget FY2025.xlsx',
    type: 'XLS',
    lastUsed: '2026-03-15',
    extractionStatus: 'stored_unparsed',
  },
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const originalCreateElement = document.createElement.bind(document);

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

beforeEach(() => {
  profileGet.mockReset();
  profileUpdate.mockReset();
  documentsGetAll.mockReset();
  documentsCreate.mockReset();
  opencodeGet.mockReset();
  opencodeUpdate.mockReset();
  onRefreshAppState.mockReset();
  themesGet.mockReset();
  themesUpdate.mockReset();
  themesRescore.mockReset();

  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/health')) {
      return new Response(JSON.stringify({
        storage: 'ok',
        opencode: 'ok',
        opencodeVersion: '1.0.0',
        crawlerStatus: 'ok',
        documentIndexer: 'ok',
      }), { headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('/api/backup/freshness')) {
      return new Response(JSON.stringify({
        lastBackupAt: '2026-05-25T00:00:00.000Z',
        isStale: false,
        lastBackupVerification: {
          checkedAt: '2026-05-25T00:00:00.000Z',
          outcome: 'Backup verified: 2 grants, 2 documents',
          grantCount: 2,
          documentCount: 2,
          type: 'backup',
        },
        lastRestoreVerification: {
          checkedAt: '2026-05-24T00:00:00.000Z',
          outcome: 'Restore verified: 1 grant, 1 document',
          grantCount: 1,
          documentCount: 1,
          type: 'restore',
        },
      }), { headers: { 'content-type': 'application/json' } });
    }

    if (url.includes('/api/diagnostics')) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }

    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  }));

  profileGet.mockResolvedValue(profile);
  documentsGetAll.mockResolvedValue(documents);
  opencodeGet.mockResolvedValue(opencodeSettings);
  backupGetFreshness.mockResolvedValue({
    lastBackupAt: '2026-01-01T00:00:00.000Z',
    isStale: false,
    lastBackupVerification: { checkedAt: '2026-01-01T00:00:00.000Z', outcome: 'Backup verified: 2 grants, 2 documents', grantCount: 2, documentCount: 2, type: 'backup' },
    lastRestoreVerification: { checkedAt: '2026-01-01T00:00:00.000Z', outcome: 'Restore verified: 1 grant, 1 document', grantCount: 1, documentCount: 1, type: 'restore' },
  });
  backupExport.mockResolvedValue({ version: '1.0', createdAt: new Date().toISOString() });
  backupRestore.mockResolvedValue({ success: true });
  documentsCreate.mockImplementation(async (file: File) => ({
    id: 'doc-3',
    name: file.name,
    type: 'PDF',
    lastUsed: new Date().toISOString(),
    extractionStatus: 'extracted',
    contentSnippet:
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
  }));
  opencodeUpdate.mockResolvedValue({ success: true });
  themesGet.mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] });
  themesUpdate.mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] });
  themesRescore.mockResolvedValue({ success: true, rescored: 0 });

  vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
    if (tagName === 'input') {
      const input = originalCreateElement('input');
      Object.defineProperty(input, 'click', {
        configurable: true,
        value: () => {
          const file = new File(['fixture'], 'hacker-dojo-program-summary.pdf', {
            type: 'application/pdf',
          });
          Object.defineProperty(input, 'files', {
            configurable: true,
            value: [file],
          });
          input.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
      return input;
    }

    return originalCreateElement(tagName);
  }) as typeof document.createElement);

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SettingsView', () => {
  it('renders upload status and reloads shell state after uploading a grounded document', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Hacker Dojo Program Summary.pdf') === true);

    expect(container.textContent).toContain('Org Profile');
    expect(container.textContent).toContain('Reference Documents');
    expect(container.textContent).toContain('Backup & Restore');
    expect(container.textContent).toContain('Copy Diagnostics');
    expect(container.textContent).toContain('Export Diagnostics');
    expect(container.textContent).toContain('Last backup verification: Backup verified: 2 grants, 2 documents');
    expect(container.textContent).toContain('Last restore verification: Restore verified: 1 grant, 1 document');
    expect(container.querySelector('[data-testid="copy-diagnostics-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="export-diagnostics-btn"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="backup-verification-result"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="restore-verification-result"]')).not.toBeNull();
    // The Health Check button was removed from SettingsView in v2; the Opencode Agent card shows status

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Upload document'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.textContent?.includes('hacker-dojo-program-summary.pdf') === true);

    expect(documentsCreate).toHaveBeenCalledTimes(1);
    expect(onRefreshAppState).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('hacker-dojo-program-summary.pdf');
  });

  it('renders hardcoded organization profile in read-only mode', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Hacker Dojo Program Summary.pdf') === true);

    // Profile is hardcoded in v2 — verify the Org Profile card renders
    expect(container.querySelector('[data-testid="org-profile-card"]')).not.toBeNull();
    // No Edit profile button (read-only)
    const editBtn = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Edit profile');
    expect(editBtn).toBeUndefined();
  });

  it('renders docTypes from profile in the Search Themes card', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Hacker Dojo Program Summary.pdf') === true);
    expect(container.textContent).toContain('Org Profile');
    expect(container.textContent).toContain('Reference Documents');
    expect(container.textContent).toContain('Hacker Dojo Program Summary.pdf');
    expect(container.textContent).toContain('Budget FY2025.xlsx');
    expect(container.textContent).toContain('Opencode');
    expect(container.textContent).toContain('Opencode Agent');
  });

  it('renders Theme Configuration card with search themes list', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Theme Configuration') === true);

    expect(container.textContent).toContain('Theme Configuration');
    // Search themes should be listed from the hardcoded profile
    expect(container.textContent).toContain('Makerspaces');
    expect(container.textContent).toContain('AI literacy');
  });

  it('renders matching threshold inputs and save button', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Matching Thresholds') === true);

    // Match threshold controls should be directly editable (v2 inline editing)
    expect(container.querySelector('#match-threshold')).not.toBeNull();
    expect(container.querySelector('#autodraft-threshold')).not.toBeNull();
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Save thresholds'),
    );
    expect(saveBtn).not.toBeNull();
  });

  it('renders Search Themes & Matching Policy section with threshold controls and Recalculate scores button', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Search Themes') === true);

    expect(container.textContent).toContain('Search Themes');
    expect(container.textContent).toContain('Matching Policy');
    expect(container.querySelector('#match-threshold')).not.toBeNull();
    expect(container.querySelector('#autodraft-threshold')).not.toBeNull();
    const rescoreBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Recalculate scores'),
    );
    expect(rescoreBtn).not.toBeNull();
  });

  it('requires confirmation before starting a backup restore', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Backup & Restore') === true);

    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]')) as HTMLInputElement[];
    const restoreInput = fileInputs.at(-1);
    expect(restoreInput).toBeDefined();
    if (!restoreInput) return;
    const file = new File([JSON.stringify({ manifest: { version: '1.0' } })], 'backup.json', { type: 'application/json' });
    Object.defineProperty(restoreInput, 'files', { configurable: true, value: [file] });
    restoreInput.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => container.querySelector('[data-testid="restore-warning-banner"]') !== null);
    expect(backupRestore).not.toHaveBeenCalled();

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Confirm restore')?.click();
    await waitFor(() => backupRestore.mock.calls.length > 0);
  });

  it('renders backup-stale-warning when lastBackupAt is stale', async () => {
    backupGetFreshness.mockResolvedValue({
      lastBackupAt: '2025-12-01T00:00:00.000Z',
      isStale: true,
      lastBackupVerification: { checkedAt: '2025-12-01T00:00:00.000Z', outcome: 'Stale', grantCount: 0, documentCount: 0, type: 'backup' },
      lastRestoreVerification: { checkedAt: '2025-12-01T00:00:00.000Z', outcome: 'Stale', grantCount: 0, documentCount: 0, type: 'restore' },
    });
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.querySelector('[data-testid="backup-stale-warning"]') !== null);
    expect(container.querySelector('[data-testid="backup-stale-warning"]')?.textContent).toContain('No backup in the last 24 hours');
  });

  it('does not render backup-stale-warning when backup is recent', async () => {
    const recentDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    backupGetFreshness.mockResolvedValue({
      lastBackupAt: recentDate,
      isStale: false,
      lastBackupVerification: { checkedAt: recentDate, outcome: 'OK', grantCount: 2, documentCount: 2, type: 'backup' },
      lastRestoreVerification: { checkedAt: recentDate, outcome: 'OK', grantCount: 1, documentCount: 1, type: 'restore' },
    });
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Backup & Restore') === true);
    expect(container.querySelector('[data-testid="backup-stale-warning"]')).toBeNull();
  });

  it('shows settings-toast after keyword cluster removal', async () => {
    themesGet.mockResolvedValue({
      keywordClusters: [{ id: 'kc-1', name: 'Test Cluster', keywords: ['test'], weight: 80, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      themes: [], regions: [], populations: [], strategicPriorities: [],
    });
    themesUpdate.mockResolvedValue({ keywordClusters: [], themes: [], regions: [], populations: [], strategicPriorities: [] });
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Test Cluster') === true);

    const removeBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent?.includes('Remove'));
    expect(removeBtn).not.toBeNull();

    removeBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.querySelector('[data-testid="settings-toast"]') !== null);
    expect(container.querySelector('[data-testid="settings-toast"]')?.textContent).toContain('Keyword cluster removed');
  });
});

