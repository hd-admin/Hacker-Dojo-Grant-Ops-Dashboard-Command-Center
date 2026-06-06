import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildGrantDrawerViewModel,
  formatDate,
  previewText,
  saveWorkingContextField,
} from './utilities';
import type { GrantDetailResponse } from '../../../../shared/types';

describe('GrantDrawer utilities', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    globalThis.window = globalThis.window || ({} as Window);
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    vi.unstubAllGlobals();
  });

  describe('buildGrantDrawerViewModel', () => {
    it('returns default values when detail is null', () => {
      const result = buildGrantDrawerViewModel(null);
      expect(result.grant).toBeNull();
      expect(result.latestDraftVersionLabel).toBe('No draft yet');
      expect(result.latestDraftPreview).toBe('');
      expect(result.showGenerateDraft).toBe(false);
      expect(result.showRequestRevision).toBe(false);
      expect(result.showApprove).toBe(false);
      expect(result.showSubmit).toBe(false);
      expect(result.submitDisabledReason).toBeNull();
    });

    it('builds view model from detail with draft', () => {
      const detail: GrantDetailResponse = {
        grant: {
          id: 'g1',
          title: 'Test Grant',
          funder: 'Test Funder',
          funderShort: 'TF',
          award: '$100k',
          awardSort: 100000,
          deadline: '2026-12-31',
          daysOut: 100,
          fit: 85,
          tags: ['test'],
          status: 'matched',
          statusLabel: 'Matched',
          matchedAt: '2026-01-01',
          latestDraftVersion: 2,
          draftContent: 'existing draft',
        },
        latestDraft: {
          id: 'd1',
          grantId: 'g1',
          version: 3,
          content: 'latest draft content',
          createdAt: '2026-01-01T00:00:00Z',
          createdBy: 'agent',
        },
        latestRevisionRequest: null,
        approvalRecord: null,
        submissionRecord: null,
        workflow: {
          canGenerateDraft: true,
          canRequestRevision: true,
          canApprove: true,
          canSubmit: true,
          blockingReason: null,
        },
        followUps: [],
      };

      const result = buildGrantDrawerViewModel(detail);
      expect(result.grant!.id).toBe('g1');
      expect(result.latestDraftVersionLabel).toBe('Version 3');
      expect(result.latestDraftPreview).toBe('latest draft content');
      expect(result.showGenerateDraft).toBe(false);
      expect(result.showRequestRevision).toBe(true);
      expect(result.showApprove).toBe(true);
      expect(result.showSubmit).toBe(true);
      expect(result.submitDisabledReason).toBeNull();
    });

    it('shows generate draft when no draft exists and workflow allows', () => {
      const detail: GrantDetailResponse = {
        grant: {
          id: 'g1',
          title: 'Test Grant',
          funder: 'Test Funder',
          funderShort: 'TF',
          award: '$100k',
          awardSort: 100000,
          deadline: '2026-12-31',
          daysOut: 100,
          fit: 85,
          tags: ['test'],
          status: 'matched',
          statusLabel: 'Matched',
          matchedAt: '2026-01-01',
        },
        latestDraft: null,
        latestRevisionRequest: null,
        approvalRecord: null,
        submissionRecord: null,
        workflow: {
          canGenerateDraft: true,
          canRequestRevision: false,
          canApprove: false,
          canSubmit: false,
          blockingReason: 'No draft generated',
        },
        followUps: [],
      };

      const result = buildGrantDrawerViewModel(detail);
      expect(result.showGenerateDraft).toBe(true);
      expect(result.submitDisabledReason).toBe('No draft generated');
    });

    it('uses grant draft content when latestDraft is null', () => {
      const detail: GrantDetailResponse = {
        grant: {
          id: 'g1',
          title: 'Test Grant',
          funder: 'Test Funder',
          funderShort: 'TF',
          award: '$100k',
          awardSort: 100000,
          deadline: '2026-12-31',
          daysOut: 100,
          fit: 85,
          tags: ['test'],
          status: 'matched',
          statusLabel: 'Matched',
          matchedAt: '2026-01-01',
          latestDraftVersion: 1,
          draftContent: 'grant draft content',
        },
        latestDraft: null,
        latestRevisionRequest: null,
        approvalRecord: null,
        submissionRecord: null,
        workflow: {
          canGenerateDraft: false,
          canRequestRevision: false,
          canApprove: false,
          canSubmit: false,
          blockingReason: null,
        },
        followUps: [],
      };

      const result = buildGrantDrawerViewModel(detail);
      expect(result.latestDraftVersionLabel).toBe('Version 1');
      expect(result.latestDraftPreview).toBe('grant draft content');
    });
  });

  describe('formatDate', () => {
    it('returns Rolling for rolling deadlines', () => {
      expect(formatDate('Rolling')).toBe('Rolling');
    });

    it('formats ISO date strings', () => {
      expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
      expect(formatDate('2026-01-05')).toBe('Jan 5, 2026');
      expect(formatDate('2026-06-15')).toBe('Jun 15, 2026');
    });
  });

  describe('previewText', () => {
    it('returns default message for empty text', () => {
      expect(previewText('')).toBe('No draft has been generated yet.');
    });

    it('returns text unchanged when within limit', () => {
      const text = 'Short text';
      expect(previewText(text)).toBe(text);
    });

    it('truncates text exceeding limit', () => {
      const longText = 'a'.repeat(300);
      const result = previewText(longText);
      expect(result).toContain('\u2026');
      expect(result.length).toBeLessThanOrEqual(282);
    });

    it('uses custom limit when provided', () => {
      const text = 'hello world';
      expect(previewText(text, 5)).toBe('hello\u2026');
    });
  });

  describe('saveWorkingContextField', () => {
    it('saves field to localStorage', () => {
      const storage: Record<string, string> = {};
      const mockStorage = {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });

      saveWorkingContextField('recentDraftId', 'draft-123');

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'grantops.workingContext',
        expect.stringContaining('draft-123'),
      );

      const saved = JSON.parse(storage['grantops.workingContext'] || '{}');
      expect(saved.recentDraftId).toBe('draft-123');
    });

    it('merges with existing context', () => {
      const storage: Record<string, string> = {
        'grantops.workingContext': JSON.stringify({ existingField: 'value' }),
      };
      const mockStorage = {
        getItem: vi.fn((key: string) => storage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          storage[key] = value;
        }),
      } as unknown as Storage;

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true,
      });

      saveWorkingContextField('newField', 'newValue');

      const saved = JSON.parse(storage['grantops.workingContext'] || '{}');
      expect(saved.existingField).toBe('value');
      expect(saved.newField).toBe('newValue');
    });

    it('handles missing localStorage gracefully', () => {
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      expect(() => saveWorkingContextField('field', 'value')).not.toThrow();
    });
  });
});
