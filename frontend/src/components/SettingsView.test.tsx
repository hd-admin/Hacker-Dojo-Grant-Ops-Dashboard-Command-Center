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
});

describe('SettingsView', () => {
  it('renders upload status and reloads shell state after uploading a grounded document', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('Hacker Dojo Program Summary.pdf') === true);

    expect(container.textContent).toContain('grounded');
    expect(container.textContent).toContain('stored only');

    container.querySelector('button.upload-item')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await waitFor(() => container.textContent?.includes('hacker-dojo-program-summary.pdf') === true);

    expect(documentsCreate).toHaveBeenCalledTimes(1);
    expect(onRefreshAppState).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('grounded');
  });

  it('renders docTypes from profile in the Search Themes card', async () => {
    root.render(React.createElement(SettingsView, { onRefreshAppState }));
    await waitFor(() => container.textContent?.includes('PDF') === true);
    expect(container.textContent).toContain('XLS');
    expect(container.textContent).toContain('DOC');
  });
});
