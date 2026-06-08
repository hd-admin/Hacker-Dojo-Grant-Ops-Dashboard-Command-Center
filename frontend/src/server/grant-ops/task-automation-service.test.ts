/**
 * Task Automation Service Tests
 *
 * Black-box tests for the canonical auto-task generation. The
 * service is re-homed from task-service.ts in audit pass 9; the
 * existing task-service tests continue to call through the
 * re-export, while this file owns the per-requirement coverage
 * required by spec section 04 'Auto-Generated Tasks (from grant
 * requirements)'.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { withTempDataDir, invalidateCache } from '../../../../shared/grant-ops-persistence';
import { truncateDatabase, getSqliteState } from '../../../../shared/grant-ops-sqlite';
import { setDependencies, resetDependencies, createDependencies } from './dependencies';
import type { Grant } from '../../../../shared/types';
import {
  REQUIREMENT_TEMPLATES,
  extractRequirementsFromGrant,
  extractAllRequiredRequirements,
  materializeAutoTasksForGrant,
  type RequirementKey,
} from './task-automation-service';

const mockGrant: Grant = {
  id: 'auto-grant-1',
  title: 'Community Tech Access Grant',
  funder: 'Acme Foundation',
  funderShort: 'AF',
  award: '$75,000',
  awardSort: 75000,
  deadline: '2026-12-31',
  daysOut: 180,
  fit: 90,
  tags: ['Education'],
  status: 'matched',
  statusLabel: 'Matched',
  matchedAt: '2026-01-15',
};

describe('TaskAutomationService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;
  let state: ReturnType<typeof getSqliteState> | null = null;

  beforeAll(async () => {
    tempDataDir = await withTempDataDir();
    state = getSqliteState();
  });

  afterAll(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    state = null;
    resetDependencies();
  });

  beforeEach(async () => {
    if (state) {
      await truncateDatabase(state);
    }
    invalidateCache();
    resetDependencies();
    setDependencies(createDependencies());
  });

  // ==================== REQUIREMENT_TEMPLATES ====================

  describe('REQUIREMENT_TEMPLATES', () => {
    it('exposes all spec-required pre-submission requirements', () => {
      const required: RequirementKey[] = [
        '501c3-verification',
        'sam-gov-registration',
        'budget',
        'board-list',
        'letters-of-support',
        'logic-model',
      ];
      for (const key of required) {
        expect(REQUIREMENT_TEMPLATES[key]).toBeDefined();
        expect(REQUIREMENT_TEMPLATES[key].key).toBe(key);
        expect(typeof REQUIREMENT_TEMPLATES[key].textTemplate).toBe('function');
      }
    });

    it('blocks submission for the mandatory requirements per spec table', () => {
      const mandatoryBlockers: RequirementKey[] = [
        '501c3-verification',
        'sam-gov-registration',
        'budget',
        'board-list',
        'logic-model',
      ];
      for (const key of mandatoryBlockers) {
        expect(REQUIREMENT_TEMPLATES[key].blockSubmission).toBe(true);
      }
    });

    it('does not block submission for letters-of-support (collected but not gating)', () => {
      expect(REQUIREMENT_TEMPLATES['letters-of-support'].blockSubmission).toBe(false);
    });

    it('routes the finance-tagged requirements to the finance responsibility', () => {
      expect(REQUIREMENT_TEMPLATES['501c3-verification'].responsibilityTag).toBe('finance');
      expect(REQUIREMENT_TEMPLATES['sam-gov-registration'].responsibilityTag).toBe('finance');
      expect(REQUIREMENT_TEMPLATES.budget.responsibilityTag).toBe('finance');
    });

    it('routes the program-tagged requirements to the program responsibility', () => {
      expect(REQUIREMENT_TEMPLATES['board-list'].responsibilityTag).toBe('program');
      expect(REQUIREMENT_TEMPLATES['letters-of-support'].responsibilityTag).toBe('program');
      expect(REQUIREMENT_TEMPLATES['logic-model'].responsibilityTag).toBe('program');
    });
  });

  // ==================== Per-requirement extract ====================

  describe('extractRequirementsFromGrant', () => {
    it('generates a 501(c)(3) verification task with finance tag and blockSubmission', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, '501c3-verification');
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Verify current 501(c)(3) tax-exempt status letter for Acme Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('finance');
      expect(tasks[0]!.blockSubmission).toBe(true);
      expect(tasks[0]!.grantId).toBe(mockGrant.id);
    });

    it('generates a SAM.gov registration task with finance tag and blockSubmission', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'sam-gov-registration');
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.text).toBe('Confirm SAM.gov registration is active for Acme Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('finance');
      expect(tasks[0]!.blockSubmission).toBe(true);
    });

    it('generates a budget task that includes the grant title', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'budget');
      expect(tasks[0]!.text).toBe(
        'Prepare budget narrative and line items for Acme Foundation (Community Tech Access Grant)',
      );
      expect(tasks[0]!.responsibilityTag).toBe('finance');
      expect(tasks[0]!.blockSubmission).toBe(true);
    });

    it('generates a board list task with program responsibility', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'board-list');
      expect(tasks[0]!.text).toBe(
        'Compile current board of directors list for Acme Foundation submission',
      );
      expect(tasks[0]!.responsibilityTag).toBe('program');
      expect(tasks[0]!.blockSubmission).toBe(true);
    });

    it('generates a letters-of-support task that does NOT block submission', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'letters-of-support');
      expect(tasks[0]!.text).toBe('Collect letters of support for Acme Foundation');
      expect(tasks[0]!.responsibilityTag).toBe('program');
      expect(tasks[0]!.blockSubmission).toBe(false);
    });

    it('generates a logic model task with program responsibility and blockSubmission', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'logic-model');
      expect(tasks[0]!.text).toBe('Develop logic model for Acme Foundation (Community Tech Access Grant)');
      expect(tasks[0]!.responsibilityTag).toBe('program');
      expect(tasks[0]!.blockSubmission).toBe(true);
    });

    it('preserves the legacy phase keys (draft/review/finance/follow-up/maintenance/program)', () => {
      const legacy: RequirementKey[] = [
        'draft',
        'review',
        'finance',
        'follow-up',
        'maintenance',
        'program',
      ];
      for (const k of legacy) {
        const tasks = extractRequirementsFromGrant(mockGrant, k);
        expect(tasks).toHaveLength(1);
        expect(tasks[0]!.grantId).toBe(mockGrant.id);
      }
    });

    it('returns an empty array for an unknown requirement key', () => {
      const tasks = extractRequirementsFromGrant(
        mockGrant,
        'unknown' as unknown as RequirementKey,
      );
      expect(tasks).toEqual([]);
    });

    it('honors the blockSubmission override when provided', () => {
      const tasks = extractRequirementsFromGrant(mockGrant, 'letters-of-support', true);
      expect(tasks[0]!.blockSubmission).toBe(true);
    });
  });

  // ==================== extractAllRequiredRequirements ====================

  describe('extractAllRequiredRequirements', () => {
    it('returns one task per spec-required pre-submission requirement', () => {
      const tasks = extractAllRequiredRequirements(mockGrant);
      const keys = new Set(tasks.map((t) => t.text));
      expect(keys.size).toBe(6);
      const expectedTexts = [
        'Verify current 501(c)(3) tax-exempt status letter for Acme Foundation',
        'Confirm SAM.gov registration is active for Acme Foundation',
        'Prepare budget narrative and line items for Acme Foundation (Community Tech Access Grant)',
        'Compile current board of directors list for Acme Foundation submission',
        'Collect letters of support for Acme Foundation',
        'Develop logic model for Acme Foundation (Community Tech Access Grant)',
      ];
      for (const expected of expectedTexts) {
        expect(keys.has(expected)).toBe(true);
      }
    });
  });

  // ==================== materializeAutoTasksForGrant ====================

  describe('materializeAutoTasksForGrant', () => {
    it('persists the generated tasks and emits a single audit event', async () => {
      const deps = createDependencies();
      setDependencies(deps);

      const newTasks = await materializeAutoTasksForGrant(mockGrant, [
        '501c3-verification',
        'budget',
      ]);

      expect(newTasks).toHaveLength(2);
      expect(newTasks[0]!.grantId).toBe(mockGrant.id);
      expect(newTasks[0]!.taskStatus).toBe('blocked');

      const stored = await deps.repository.getTasks();
      expect(stored).toHaveLength(2);
      const ids = new Set(stored.map((t) => t.id));
      expect(ids.has(newTasks[0]!.id)).toBe(true);
      expect(ids.has(newTasks[1]!.id)).toBe(true);

      const audit = await deps.repository.getAuditEvents();
      const created = audit.filter((e) => e.eventType === 'tasks_auto_generated');
      expect(created).toHaveLength(1);
      expect(created[0]!.metadata).toMatchObject({
        requirementKeys: ['501c3-verification', 'budget'],
        count: 2,
      });
    });

    it('returns an empty array when no keys are provided', async () => {
      const deps = createDependencies();
      setDependencies(deps);
      const newTasks = await materializeAutoTasksForGrant(mockGrant, []);
      expect(newTasks).toEqual([]);
    });
  });
});
