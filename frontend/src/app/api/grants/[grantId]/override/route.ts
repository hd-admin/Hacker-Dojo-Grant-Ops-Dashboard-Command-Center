import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDependencies } from '@/server/grant-ops/dependencies';
import type { Grant, GrantStatus, HumanOverride, TaskStatus } from '../../../../../../../shared/types';
import { GrantStatusSchema } from '../../../../../../../shared/schemas';

export const dynamic = 'force-dynamic';

// Allowed override target fields with their expected value types
const OVERRIDABLE_FIELDS = [
  'status',
  'statusLabel',
  'fit',
  'award',
  'deadline',
  'title',
  'funder',
  'funderShort',
  'category',
] as const;
type OverridableField = typeof OVERRIDABLE_FIELDS[number];

// Task override field pattern: task.{taskId}.status
const TASK_OVERRIDE_FIELD_REGEX = /^task\.(.+)\.status$/;

const bodySchema = z.object({
  field: z.union([z.enum(OVERRIDABLE_FIELDS), z.string().regex(TASK_OVERRIDE_FIELD_REGEX)]),
  newValue: z.unknown(),
  rationale: z.string().min(1),
  overrideType: z.enum(['score', 'category', 'task', 'status']),
});

const VALID_TASK_STATUSES: TaskStatus[] = ['blocked', 'in-progress', 'completed', 'waived', 'not-applicable'];

function validateNewValueForField(field: OverridableField, value: unknown): { success: true; parsed: GrantStatus | string | number } | { success: false; error: string } {
  switch (field) {
    case 'status': {
      const result = GrantStatusSchema.safeParse(value);
      if (!result.success) {
        return { success: false, error: `Invalid status value. Must be one of: matched, draft, review, approved, submission-ready, submitted, follow-up, awarded, declined, closed, archived` };
      }
      return { success: true, parsed: result.data };
    }
    case 'fit': {
      const num = Number(value);
      if (Number.isNaN(num) || num < 0 || num > 100) {
        return { success: false, error: 'Fit score must be a number between 0 and 100' };
      }
      return { success: true, parsed: num };
    }
    case 'statusLabel':
    case 'award':
    case 'deadline':
    case 'title':
    case 'funder':
    case 'funderShort':
    case 'category':
      if (typeof value !== 'string' && typeof value !== 'number') {
        return { success: false, error: `${field} must be a string` };
      }
      return { success: true, parsed: String(value) };
    default:
      return { success: false, error: `Unknown field: ${field}` };
  }
}

function validateTaskOverrideValue(value: unknown): { success: true; parsed: TaskStatus } | { success: false; error: string } {
  if (!VALID_TASK_STATUSES.includes(value as TaskStatus)) {
    return { success: false, error: `Invalid task status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}` };
  }
  return { success: true, parsed: value as TaskStatus };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const { grantId } = await params;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid override payload', issues: parsed.error.flatten() }, { status: 400 });
    }

    const deps = getDependencies();
    const grant = await deps.repository.getGrant(grantId);
    if (!grant) {
      return NextResponse.json({ error: 'Grant not found' }, { status: 404 });
    }

    const isTaskOverride = TASK_OVERRIDE_FIELD_REGEX.test(parsed.data.field);
    let override: HumanOverride;
    let updates: Partial<Grant>;

    if (isTaskOverride) {
      // Handle task.{taskId}.status override
      const match = parsed.data.field.match(TASK_OVERRIDE_FIELD_REGEX);
      if (!match) {
        return NextResponse.json({ error: 'Invalid task override field format' }, { status: 400 });
      }
      const taskId = match[1];

      const taskValueValidation = validateTaskOverrideValue(parsed.data.newValue);
      if (!taskValueValidation.success) {
        return NextResponse.json({ error: taskValueValidation.error }, { status: 400 });
      }

      // Load all tasks and find the target task
      const tasks = await deps.repository.getTasks();
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }

      const existingTask = tasks[taskIndex]!;
      const previousTaskStatus = existingTask.taskStatus ?? (existingTask.completed ? 'completed' : 'blocked');

      // Update the task
      tasks[taskIndex] = {
        ...existingTask,
        taskStatus: taskValueValidation.parsed,
        justification: parsed.data.rationale,
        completed: taskValueValidation.parsed === 'completed',
      };
      await deps.repository.updateTasks(tasks);

      override = {
        field: parsed.data.field,
        previousValue: previousTaskStatus,
        newValue: taskValueValidation.parsed,
        rationale: parsed.data.rationale,
        overriddenAt: new Date().toISOString(),
        overriddenBy: 'operator',
        overrideType: parsed.data.overrideType,
      };
      updates = { humanOverrides: [...(grant.humanOverrides ?? []), override] };
    } else {
      // Handle grant field override (existing logic)
      const field = parsed.data.field as OverridableField;
      const valueValidation = validateNewValueForField(field, parsed.data.newValue);
      if (!valueValidation.success) {
        return NextResponse.json({ error: valueValidation.error }, { status: 400 });
      }

      override = {
        field: field,
        previousValue: Reflect.get(grant, field),
        newValue: valueValidation.parsed,
        rationale: parsed.data.rationale,
        overriddenAt: new Date().toISOString(),
        overriddenBy: 'operator',
        overrideType: parsed.data.overrideType,
      };

      updates = { humanOverrides: [...(grant.humanOverrides ?? []), override] };
      switch (field) {
        case 'status':
          updates.status = valueValidation.parsed as GrantStatus;
          break;
        case 'statusLabel':
        case 'award':
        case 'deadline':
        case 'title':
        case 'funder':
        case 'funderShort':
        case 'category':
          (updates as Record<string, unknown>)[field] = valueValidation.parsed;
          break;
        case 'fit':
          updates.fit = valueValidation.parsed as number;
          break;
      }
    }

    await deps.repository.updateGrant(grantId, updates);

    await deps.repository.addAuditEvent({
      id: deps.idGenerator.generateId('audit'),
      eventType: 'human_override',
      entityId: grantId,
      entityType: 'grant',
      actorLabel: 'operator',
      timestamp: override.overriddenAt,
      metadata: { field: override.field, previousValue: override.previousValue, newValue: override.newValue, rationale: override.rationale, overrideType: override.overrideType },
    });

    return NextResponse.json(await deps.repository.getGrant(grantId));
  } catch (error) {
    console.error('Error overriding grant:', error);
    return NextResponse.json({ error: 'Failed to override grant' }, { status: 500 });
  }
}
