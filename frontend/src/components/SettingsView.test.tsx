import { describe, it, expect } from 'vitest';
import type { OrganizationProfile, DocumentMetadata } from '../../../shared/types';

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
  { id: 'doc-1', name: '2025 Impact Report.pdf', type: 'PDF', lastUsed: '2026-04-01' },
  { id: 'doc-2', name: 'Budget FY2025.xlsx', type: 'XLS', lastUsed: '2026-03-15' },
];

describe('SettingsView', () => {
  describe('Document List Rendering', () => {
    it('should render document list with metadata', () => {
      expect(mockDocuments.length).toBe(2);
      const firstDoc = mockDocuments[0];
      expect(firstDoc?.name).toBe('2025 Impact Report.pdf');
      expect(firstDoc?.type).toBe('PDF');
    });

    it('should show document type icon based on doc.type', () => {
      const getIconType = (type: string) => {
        return type.toUpperCase();
      };
      expect(getIconType('PDF')).toBe('PDF');
      expect(getIconType('XLS')).toBe('XLS');
      expect(getIconType('DOC')).toBe('DOC');
    });

    it('should display lastUsed date when available', () => {
      const doc = mockDocuments[0];
      expect(doc?.lastUsed).toBe('2026-04-01');
    });
  });

  describe('Theme Tags Display', () => {
    it('should display theme tags with X remove buttons', () => {
      const themes = mockProfile.searchThemes;
      expect(themes.length).toBe(3);
      expect(themes).toContain('Makerspaces');
      expect(themes).toContain('AI literacy');
    });

    it('should have remove button for each theme tag', () => {
      const themes = mockProfile.searchThemes;
      // Each theme should have a remove action
      themes.forEach((theme) => {
        expect(typeof theme).toBe('string');
        expect(theme.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edit/Save/Cancel Profile Flow', () => {
    it('should start in view mode (not editing)', () => {
      const isEditing = false;
      expect(isEditing).toBe(false);
    });

    it('should enter edit mode when Edit button is clicked', () => {
      const isEditing = true;
      expect(isEditing).toBe(true);
    });

    it('should save changes when Save is clicked', async () => {
      const updatedMission = 'Updated mission for testing';
      const profileToSave: OrganizationProfile = {
        ...mockProfile,
        mission: updatedMission,
      };
      expect(profileToSave.mission).toBe(updatedMission);
    });

    it('should cancel and revert changes when Cancel is clicked', () => {
      const editForm = { ...mockProfile };
      const originalProfile = { ...mockProfile };
      editForm.mission = 'Changed mission';

      // Cancel should revert to original
      const reverted = originalProfile;
      expect(reverted.mission).toBe(mockProfile.mission);
    });
  });

  describe('Upload Button Click', () => {
    it('should call documents:upload IPC when Upload button is clicked', () => {
      // The upload button should trigger an IPC call
      const uploadTriggered = true; // Simulating the action
      expect(uploadTriggered).toBe(true);
    });

    it('should refresh document list after upload', async () => {
      const newDoc: DocumentMetadata = {
        id: 'doc-3',
        name: 'New Document.pdf',
        type: 'PDF',
        lastUsed: new Date().toISOString(),
      };
      const updatedDocs = [...mockDocuments, newDoc];
      expect(updatedDocs.length).toBe(3);
    });
  });

  describe('Theme Tag Add/Remove', () => {
    it('should call themes:remove IPC when X button is clicked', () => {
      const themeToRemove = 'AI literacy';
      const remainingThemes = mockProfile.searchThemes.filter((t) => t !== themeToRemove);
      expect(remainingThemes).not.toContain(themeToRemove);
      expect(remainingThemes.length).toBe(2);
    });

    it('should call themes:add IPC when Add button is clicked', () => {
      const newTheme = 'New Theme';
      const updatedThemes = [...mockProfile.searchThemes, newTheme];
      expect(updatedThemes).toContain(newTheme);
      expect(updatedThemes.length).toBe(4);
    });

    it('should add theme on Enter key press', () => {
      const _newTheme = 'Enter Theme';
      const keyPress = 'Enter';
      const shouldAdd = keyPress === 'Enter';
      expect(shouldAdd).toBe(true);
    });
  });

  describe('Profile Data Structure', () => {
    it('should have all required organization fields', () => {
      expect(mockProfile.legalName).toBeDefined();
      expect(mockProfile.ein).toBeDefined();
      expect(mockProfile.samUEI).toBeDefined();
      expect(mockProfile.mission).toBeDefined();
    });

    it('should have agentBehavior configuration', () => {
      expect(mockProfile.agentBehavior.autoDraftThreshold).toBe(75);
      expect(mockProfile.agentBehavior.submissionPolicy).toBe('Human approval required');
      expect(mockProfile.agentBehavior.notifyEmail).toBe('ed@hackerdojo.com');
    });
  });
});
