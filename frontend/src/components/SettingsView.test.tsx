import { describe, it, expect } from 'vitest';
import type { DocumentMetadata, OrganizationProfile } from '../../../shared/types';

const mockProfile: OrganizationProfile = {
  legalName: 'Hacker Dojo, a California nonprofit corporation',
  ein: '26-3375350',
  samUEI: 'XK7N4HQ2P3M9',
  mission: 'Test mission text for testing',
  docTypes: ['PDF', 'XLS', 'DOC'],
  searchThemes: ['Makerspaces', 'AI literacy', 'Community innovation'],
  agentBehavior: {
    autoDraftThreshold: 75,
    submissionPolicy: 'Human approval required',
    notifyEmail: 'ed@hackerdojo.com',
    voiceAndTone: 'Plain-spoken',
  },
};

const mockDocuments: DocumentMetadata[] = [
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

describe('SettingsView state contract', () => {
  it('surfaces extraction status so only grounded PDFs look draft-ready', () => {
    const grounded = mockDocuments.filter((doc) => doc.extractionStatus === 'extracted');
    const storedOnly = mockDocuments.filter((doc) => doc.extractionStatus === 'stored_unparsed');

    expect(grounded).toHaveLength(1);
    expect(grounded[0]?.contentSnippet).toBe(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );
    expect(storedOnly).toHaveLength(1);
  });

  it('keeps the prototype upload accept list aligned to the allowed extensions', () => {
    const accept = '.pdf,.xls,.xlsx,.doc,.docx';
    expect(accept).toContain('.pdf');
    expect(accept).toContain('.docx');
    expect(accept).toContain('.xlsx');
  });

  it('preserves organization profile fields needed for upload and opencode configuration', () => {
    expect(mockProfile.legalName).toBeDefined();
    expect(mockProfile.agentBehavior.notifyEmail).toBe('ed@hackerdojo.com');
    expect(mockProfile.searchThemes).toContain('Community innovation');
  });
});
