import 'server-only';
/**
 * Task Automation Service
 *
 * Canonical auto-task generation for grant requirements.
 * Re-homed from task-service.ts per audit pass 9 to keep the
 * requirement-extraction map in one place. Per spec section 04
 * 'Auto-Generated Tasks (from grant requirements)', this service
 * maps each requirement to:
 *   - a task text template
 *   - a responsibility tag (finance / program / review / follow-up)
 *   - a blockSubmission flag (true for mandatory pre-submission gates)
 *
 * The supported requirement keys are:
 *   - '501c3-verification'  : 501(c)(3) status verification (finance, blocks)
 *   - 'sam-gov-registration': SAM.gov registration is current (finance, blocks)
 *   - 'budget'              : budget narrative + line items (finance, blocks)
 *   - 'board-list'          : current board of directors list (program, blocks)
 *   - 'letters-of-support'  : collect letters of support (program, no-block)
 *   - 'logic-model'         : program logic model / theory of change (program, blocks)
 *   - 'draft'               : generate draft LOI / narrative (program, no-block)
 *   - 'review'              : internal review of the draft (review, blocks)
 *   - 'finance'             : budget + finance review (finance, blocks)
 *   - 'follow-up'           : schedule follow-up after submission (follow-up, no-block)
 *   - 'maintenance'         : maintain records post-award (follow-up, no-block)
 *   - 'program'             : program evaluation (program, no-block)
 *
 * Backward-compat note: the existing call sites in task-service.ts
 * (which used `RequirementPhase` keys: 'draft', 'review', 'finance',
 * 'follow-up', 'maintenance', 'program') are preserved. Existing
 * tests in task-service.test.ts call
 * `extractRequirementsFromGrant(grant, 'draft')` and continue to
 * work unchanged.
 */

import type { Grant, Task, ResponsibilityTag } from '../../../../shared/types';
import { getDependencies } from './dependencies';

export type RequirementKey =
  | '501c3-verification'
  | 'sam-gov-registration'
  | 'budget'
  | 'board-list'
  | 'letters-of-support'
  | 'logic-model'
  | 'draft'
  | 'review'
  | 'finance'
  | 'follow-up'
  | 'maintenance'
  | 'program';

export interface RequirementTemplate {
  /** Stable, machine-readable requirement key. */
  key: RequirementKey;
  /** Human-readable name. */
  label: string;
  /** Template that produces the auto-task text. */
  textTemplate: (funder: string, title: string) => string;
  /** Responsibility tag applied to the auto-generated task. */
  responsibilityTag: ResponsibilityTag;
  /** Whether this task blocks submission-ready. */
  blockSubmission: boolean;
  /** Short description used in operator-facing documentation. */
  description: string;
}

export const REQUIREMENT_TEMPLATES: Record<RequirementKey, RequirementTemplate> = {
  '501c3-verification': {
    key: '501c3-verification',
    label: '501(c)(3) verification',
    textTemplate: (funder) =>
      `Verify current 501(c)(3) tax-exempt status letter for ${funder}`,
    responsibilityTag: 'finance',
    blockSubmission: true,
    description:
      'Confirm IRS 501(c)(3) determination letter is on file and matches the legal name on the application.',
  },
  'sam-gov-registration': {
    key: 'sam-gov-registration',
    label: 'SAM.gov registration',
    textTemplate: (funder) => `Confirm SAM.gov registration is active for ${funder}`,
    responsibilityTag: 'finance',
    blockSubmission: true,
    description:
      'Verify the organization is registered in SAM.gov and the registration is not expired or in renewal.',
  },
  budget: {
    key: 'budget',
    label: 'Budget narrative + line items',
    textTemplate: (funder, title) =>
      `Prepare budget narrative and line items for ${funder} (${title})`,
    responsibilityTag: 'finance',
    blockSubmission: true,
    description:
      'Draft the project budget with line items, justification, and total cost; align to funder caps.',
  },
  'board-list': {
    key: 'board-list',
    label: 'Current board list',
    textTemplate: (funder) =>
      `Compile current board of directors list for ${funder} submission`,
    responsibilityTag: 'program',
    blockSubmission: true,
    description:
      'Provide a current list of board members with roles; required for most foundation applications.',
  },
  'letters-of-support': {
    key: 'letters-of-support',
    label: 'Letters of support',
    textTemplate: (funder) => `Collect letters of support for ${funder}`,
    responsibilityTag: 'program',
    blockSubmission: false,
    description:
      'Collect signed letters of support from partners, beneficiaries, or community leaders as required.',
  },
  'logic-model': {
    key: 'logic-model',
    label: 'Logic model / theory of change',
    textTemplate: (funder, title) =>
      `Develop logic model for ${funder} (${title})`,
    responsibilityTag: 'program',
    blockSubmission: true,
    description:
      'Articulate inputs, activities, outputs, and outcomes that demonstrate the program theory of change.',
  },
  draft: {
    key: 'draft',
    label: 'Generate draft narrative',
    textTemplate: (funder) => `Generate draft LOI / narrative for ${funder}`,
    responsibilityTag: 'program',
    blockSubmission: false,
    description: 'Draft the initial LOI or full narrative for the application.',
  },
  review: {
    key: 'review',
    label: 'Internal review of draft',
    textTemplate: (funder) => `Internal review of draft for ${funder}`,
    responsibilityTag: 'review',
    blockSubmission: true,
    description: 'Peer review the draft for clarity, alignment, and grounding before approval.',
  },
  finance: {
    key: 'finance',
    label: 'Budget + finance review',
    textTemplate: (funder, title) =>
      `Verify budget and finance for ${funder} (${title})`,
    responsibilityTag: 'finance',
    blockSubmission: true,
    description: 'Finance team review of the budget for compliance and realism.',
  },
  'follow-up': {
    key: 'follow-up',
    label: 'Schedule follow-up',
    textTemplate: (funder) => `Schedule follow-up for ${funder}`,
    responsibilityTag: 'follow-up',
    blockSubmission: false,
    description: 'After submission, schedule the first follow-up milestone.',
  },
  maintenance: {
    key: 'maintenance',
    label: 'Maintain records post-award',
    textTemplate: (funder) => `Maintain records for ${funder}`,
    responsibilityTag: 'follow-up',
    blockSubmission: false,
    description: 'Ongoing record-keeping, reporting, and stewardship after award.',
  },
  program: {
    key: 'program',
    label: 'Program evaluation',
    textTemplate: (funder) => `Program evaluation for ${funder}`,
    responsibilityTag: 'program',
    blockSubmission: false,
    description: 'Internal program evaluation and outcome tracking.',
  },
};

/**
 * Extract one auto-task per requirement key for a given grant.
 * Each task is created via deps.repository.updateTasks and recorded
 * in the audit log, so the tasks flow through the existing
 * TasksView surface.
 */
export function extractRequirementsFromGrant(
  grant: Grant,
  phase: RequirementKey,
  blockSubmissionOverride?: boolean,
): Partial<Task>[] {
  const template = REQUIREMENT_TEMPLATES[phase];
  if (!template) return [];

  const deps = getDependencies();
  const idGenerator = deps.idGenerator;

  const blockSubmission = blockSubmissionOverride ?? template.blockSubmission;

  const task: Partial<Task> = {
    id: idGenerator.generateId('task'),
    text: template.textTemplate(grant.funder, grant.title),
    completed: false,
    grantId: grant.id,
    taskStatus: 'blocked',
    responsibilityTag: template.responsibilityTag,
    blockSubmission,
    dependsOn: [],
  };

  return [task];
}

/**
 * Extract auto-tasks for ALL the spec's required pre-submission
 * requirements (501c3, SAM.gov, budget, board list, letters of
 * support, logic model). Convenience helper used when a grant
 * transitions to a new state and needs a full prerequisite sweep.
 */
export function extractAllRequiredRequirements(grant: Grant): Partial<Task>[] {
  const requiredKeys: RequirementKey[] = [
    '501c3-verification',
    'sam-gov-registration',
    'budget',
    'board-list',
    'letters-of-support',
    'logic-model',
  ];
  return requiredKeys.flatMap((k) => extractRequirementsFromGrant(grant, k));
}

/**
 * Materialize the auto-task list into the repository and emit a
 * single audit event. This is the canonical entry-point used by
 * the pipeline when a grant moves into the matching / draft
 * phase; the resulting tasks appear in TasksView immediately.
 */
export async function materializeAutoTasksForGrant(
  grant: Grant,
  keys: RequirementKey[],
): Promise<Task[]> {
  const deps = getDependencies();
  const clock = deps.clock;
  const idGenerator = deps.idGenerator;

  const existing = await deps.repository.getTasks();
  const newTasks: Task[] = keys
    .map((k) => extractRequirementsFromGrant(grant, k)[0])
    .filter((t): t is Partial<Task> & { id: string; text: string } => Boolean(t?.id && t.text))
    .map((partial) => {
      const t: Task = {
        id: partial.id!,
        text: partial.text!,
        completed: false,
        ...(partial.grantId ? { grantId: partial.grantId } : {}),
        taskStatus: 'blocked',
        responsibilityTag: partial.responsibilityTag ?? 'program',
        dependsOn: [],
        blockSubmission: partial.blockSubmission ?? false,
      };
      return t;
    });

  if (newTasks.length === 0) return [];

  await deps.repository.updateTasks([...existing, ...newTasks]);
  await deps.repository.addAuditEvent({
    id: idGenerator.generateId('audit'),
    eventType: 'tasks_auto_generated',
    entityId: grant.id,
    entityType: 'grant',
    actorLabel: 'automation',
    timestamp: clock.now().toISOString(),
    metadata: {
      requirementKeys: keys,
      count: newTasks.length,
    },
  });

  return newTasks;
}
