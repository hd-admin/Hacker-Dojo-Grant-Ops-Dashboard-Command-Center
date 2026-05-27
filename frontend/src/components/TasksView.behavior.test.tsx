import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'next/dist/compiled/react-dom/client';
import type { Task } from '../../../shared/types';

const tasksGetAllMock = vi.hoisted(() => vi.fn());
const tasksUpdateMock = vi.hoisted(() => vi.fn().mockResolvedValue({ success: true }));
const tasksOverrideMock = vi.hoisted(() => vi.fn().mockResolvedValue({}));
const followUpsGetAllMock = vi.hoisted(() => vi.fn());

vi.mock('../lib/grant-ops-client', () => ({
  tasksApi: {
    getAll: tasksGetAllMock,
    update: tasksUpdateMock,
    create: vi.fn(),
    override: tasksOverrideMock,
  },
  followUpsApi: {
    getAll: followUpsGetAllMock,
    update: vi.fn().mockResolvedValue({ success: true }),
  },
}));

import TasksView from './TasksView';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

beforeEach(() => {
  tasksGetAllMock.mockReset();
  tasksUpdateMock.mockClear();
  tasksOverrideMock.mockClear();
  followUpsGetAllMock.mockReset();

  const tasks: Task[] = [
    { id: 'task-1', text: 'Review budget', completed: false, taskStatus: 'in-progress', justification: 'Need finance sign-off' },
    { id: 'task-2', text: 'Send follow-up email', completed: true },
  ];
  tasksGetAllMock.mockResolvedValue(tasks);
  followUpsGetAllMock.mockResolvedValue([]);

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  container.remove();
  vi.clearAllMocks();
});

describe('TasksView behavior', () => {
  it('shows existing rationale and saves task override updates', async () => {
    root.render(React.createElement(TasksView, { onRefreshAppState: vi.fn() }));
    await waitFor(() => container.textContent?.includes('Need finance sign-off') === true);

    expect(container.textContent).toContain('Rationale: Need finance sign-off');
    expect(container.querySelector('[data-testid="task-override-btn"]')).not.toBeNull();

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Override')?.click();
    await waitFor(() => container.textContent?.includes('Save override') === true);

    const overridePanel = container.querySelector('.task-override-panel');
    const select = overridePanel?.querySelector('select') as HTMLSelectElement;
    const textarea = overridePanel?.querySelector('textarea') as HTMLTextAreaElement;
    select.value = 'waived';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    setTextareaValue(textarea, 'Operator reviewed and waived the task.');

    Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save override')?.click();
    await waitFor(() => tasksOverrideMock.mock.calls.length === 1);

    expect(tasksOverrideMock.mock.calls[0]?.[0]).toMatchObject({
      id: 'task-1',
      newValue: 'waived',
      rationale: 'Operator reviewed and waived the task.',
      overrideType: 'task',
    });
  });
});
