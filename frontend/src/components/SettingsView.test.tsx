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

vi.mock('../lib/grant-ops-client', () => ({
  client: {
    profile: { get: profileGet, update: profileUpdate },
    documents: { getAll: documentsGetAll, create: documentsCreate },
    opencodeSettings: { get: opencodeGet, update: opencodeUpdate },
  },
}));

import SettingsView from './SettingsView';

const profile: OrganizationProfile = {
  legalName: 'Hacker Dojo, a California nonprofit corporation',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  mission: 'Community innovation and technology education',
  docTypes: ['PDF', 'XLS', 'DOC'],
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
    expect(container.querySelector('[data-testid="rerun-health-check-btn"]')).not.toBeNull();

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Upload document'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.textContent?.includes('hacker-dojo-program-summary.pdf') === true);

    expect(documentsCreate).toHaveBeenCalledTimes(1);
    expect(onRefreshAppState).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('hacker-dojo-program-summary.pdf');
  });

  it('shows the unsaved-change badge when profile inputs are edited', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState, initiallyDirty: true }));

    await waitFor(() => container.querySelector('[data-testid="settings-unsaved-badge"]') !== null);
    expect(container.querySelector('[data-testid="settings-unsaved-badge"]')?.textContent).toContain('Unsaved changes');
  });

  it('renders docTypes from profile in the Search Themes card', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Hacker Dojo Program Summary.pdf') === true);
    expect(container.textContent).toContain('Org Profile');
    expect(container.textContent).toContain('Reference Documents');
    expect(container.textContent).toContain('Hacker Dojo Program Summary.pdf');
    expect(container.textContent).toContain('Budget FY2025.xlsx');
    expect(container.textContent).toContain('Opencode');
    expect(container.textContent).toContain('Edit Opencode');
  });

  it('requires confirmation before starting a backup restore', async () => {
    const fetchMock = vi.mocked(global.fetch as unknown as typeof fetch);
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
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/restore'))).toBe(false);

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Confirm restore')?.click();
    await waitFor(() => fetchMock.mock.calls.some(([url]) => String(url).includes('/api/restore')) === true);
  });
});
