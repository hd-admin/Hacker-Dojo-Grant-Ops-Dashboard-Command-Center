import { describe, it, expect } from 'vitest';
import { GrantStatusSchema } from './schemas';

describe('shared/types', () => {
  describe('GrantStatus', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['matched', 'draft', 'review', 'submitted', 'awarded'];
      for (const status of validStatuses) {
        const result = GrantStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status "discarded"', () => {
      const result = GrantStatusSchema.safeParse('discarded');
      expect(result.success).toBe(false);
    });

    it('should reject arbitrary invalid strings', () => {
      const invalidStatuses = ['pending', 'unknown', 'cancelled', ''];
      for (const status of invalidStatuses) {
        const result = GrantStatusSchema.safeParse(status);
        expect(result.success).toBe(false);
      }
    });
  });
});
