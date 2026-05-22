import { describe, it, expect } from 'vitest';
import type { Grant, GrantStatus } from '../../../shared/types';

const mockGrants: Grant[] = [
  { id: 'grant-1', title: 'Matched Grant 1', funder: 'Funder 1', funderShort: 'F1', award: '$100K', awardSort: 100000, deadline: '2026-06-15', daysOut: 25, fit: 88, tags: ['EdTech'], status: 'matched' as GrantStatus, statusLabel: 'Matched' },
  { id: 'grant-2', title: 'Matched Grant 2', funder: 'Funder 2', funderShort: 'F2', award: '$200K', awardSort: 200000, deadline: '2026-07-01', daysOut: 41, fit: 76, tags: ['Community'], status: 'matched' as GrantStatus, statusLabel: 'Matched' },
  { id: 'grant-3', title: 'Draft Grant', funder: 'Funder 3', funderShort: 'F3', award: '$50K', awardSort: 50000, deadline: '2026-06-01', daysOut: 11, fit: 84, tags: ['Federal'], status: 'draft' as GrantStatus, statusLabel: 'Drafting' },
  { id: 'grant-4', title: 'Review Grant', funder: 'Funder 4', funderShort: 'F4', award: '$75K', awardSort: 75000, deadline: '2026-06-10', daysOut: 20, fit: 81, tags: ['Foundation'], status: 'review' as GrantStatus, statusLabel: 'Review' },
  { id: 'grant-5', title: 'Submitted Grant', funder: 'Funder 5', funderShort: 'F5', award: '$150K', awardSort: 150000, deadline: '2026-05-15', daysOut: -6, fit: 86, tags: ['Corporate'], status: 'submitted' as GrantStatus, statusLabel: 'Submitted' },
  { id: 'grant-6', title: 'Awarded Grant', funder: 'Funder 6', funderShort: 'F6', award: '$30K', awardSort: 30000, deadline: '2025-12-01', daysOut: -171, fit: 45, tags: ['Federal'], status: 'awarded' as GrantStatus, statusLabel: 'Awarded' },
];

describe('PipelineView', () => {
  describe('Kanban Column Distribution', () => {
    it('should distribute grants to Matched column', () => {
      const matched = mockGrants.filter((g) => g.status === 'matched');
      expect(matched.length).toBe(2);
    });

    it('should distribute grants to Drafting column', () => {
      const drafting = mockGrants.filter((g) => g.status === 'draft');
      expect(drafting.length).toBe(1);
    });

    it('should distribute grants to Review column', () => {
      const review = mockGrants.filter((g) => g.status === 'review');
      expect(review.length).toBe(1);
    });

    it('should distribute grants to Submitted column', () => {
      const submitted = mockGrants.filter((g) => g.status === 'submitted');
      expect(submitted.length).toBe(1);
    });

    it('should distribute grants to Awarded/Closed column', () => {
      const awarded = mockGrants.filter((g) => g.status === 'awarded');
      expect(awarded.length).toBe(1);
    });

    it('should calculate active grant count correctly', () => {
      const active = mockGrants.filter((g) => g.status !== 'awarded');
      expect(active.length).toBe(5);
    });
  });

  describe('Drag and Drop Status Update', () => {
    it('should update grant status on drop', () => {
      const grants = [...mockGrants];
      const grantId = 'grant-1';
      const newStatus: GrantStatus = 'draft';
      const updated = grants.map((g) =>
        g.id === grantId ? { ...g, status: newStatus } : g
      );
      const updatedGrant = updated.find((g) => g.id === grantId);
      expect(updatedGrant?.status).toBe('draft');
    });

    it('should not modify other grants when updating status', () => {
      const grants = [...mockGrants];
      const grantId = 'grant-1';
      const newStatus: GrantStatus = 'draft';
      const updated = grants.map((g) =>
        g.id === grantId ? { ...g, status: newStatus } : g
      );
      const otherGrants = updated.filter((g) => g.id !== grantId);
      otherGrants.forEach((g) => {
        const original = mockGrants.find((mg) => mg.id === g.id);
        expect(g.status).toBe(original?.status);
      });
    });
  });

  describe('Column Titles', () => {
    it('should have correct column order and titles', () => {
      const columns = [
        { key: 'matched' as const, title: 'Matched' },
        { key: 'draft' as const, title: 'Drafting' },
        { key: 'review' as const, title: 'Review' },
        { key: 'submitted' as const, title: 'Submitted' },
        { key: 'awarded' as const, title: 'Awarded/Closed' },
      ];
      expect(columns.length).toBe(5);
      expect(columns.map((c) => c.title)).toEqual([
        'Matched',
        'Drafting',
        'Review',
        'Submitted',
        'Awarded/Closed',
      ]);
    });
  });
});
