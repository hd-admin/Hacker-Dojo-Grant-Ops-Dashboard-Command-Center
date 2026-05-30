'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { FollowUp, Task, TaskStatus, ResponsibilityTag } from '../../../shared/types';
import { tasksApi, followUpsApi, grantsApi } from '../lib/grant-ops-client';

type ViewType = 'dashboard' | 'discovery' | 'pipeline' | 'sources' | 'settings' | 'notifications' | 'tasks';

interface TasksViewProps {
  onRefreshAppState?: () => Promise<void> | void;
  tasks?: Task[];
  onNavigate?: (view: ViewType) => void;
}

export default function TasksView({ onRefreshAppState, tasks: tasksProp, onNavigate }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>(tasksProp ?? []);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>('blocked');
  const [newTaskResponsibility, setNewTaskResponsibility] = useState<ResponsibilityTag | ''>('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskBlockSubmission, setNewTaskBlockSubmission] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [overrideTaskId, setOverrideTaskId] = useState<string | null>(null);
  const [overrideTaskStatus, setOverrideTaskStatus] = useState<TaskStatus>('blocked');
  const [overrideTaskRationale, setOverrideTaskRationale] = useState('');

  useEffect(() => {
    if (tasksProp) {
      setTasks(tasksProp);
    }
  }, [tasksProp]);

  useEffect(() => {
    async function load() {
      try {
        const [tasksData, followUpsData] = await Promise.all([
          tasksApi.getAll(),
          followUpsApi.getAll(),
        ]);
        setTasks(tasksData);
        setFollowUps(followUpsData);
      } catch (error) {
        console.error('Error loading tasks:', error);
        setTasks([]);
        setFollowUps([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t,
    );
    setTasks(updatedTasks);
    await tasksApi.update(updatedTasks);
    await onRefreshAppState?.();
  };

  const handleToggleFollowUp = async (id: string) => {
    const followUp = followUps.find((fu) => fu.id === id);
    if (!followUp) return;
    const isNowComplete = followUp.status !== 'completed';
    const updated: FollowUp = isNowComplete
      ? {
          ...followUp,
          status: 'completed',
          completedAt: new Date().toISOString(),
        }
      : {
          ...followUp,
          status: 'pending',
        };
    setFollowUps((prev) => prev.map((fu) => (fu.id === id ? updated : fu)));
    try {
      await followUpsApi.update(updated);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error updating follow-up:', error);
      setFollowUps((prev) => prev.map((fu) => (fu.id === id ? followUp : fu)));
    }
  };

  const handleAddTask = () => {
    setShowAddTaskForm(true);
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    setIsAddingTask(true);
    try {
      const createPayload: Omit<Task, 'id'> = {
        completed: false,
        text: newTaskText.trim(),
        taskStatus: newTaskStatus,
      };
      if (newTaskResponsibility) createPayload.responsibilityTag = newTaskResponsibility;
      if (newTaskDueDate) createPayload.dueDate = newTaskDueDate;
      if (newTaskBlockSubmission) createPayload.blockSubmission = true;

      const newTask = await tasksApi.create(createPayload);
      setTasks((prev) => [...prev, newTask]);
      setNewTaskText('');
      setNewTaskStatus('blocked');
      setNewTaskResponsibility('');
      setNewTaskDueDate('');
      setNewTaskBlockSubmission(false);
      setShowAddTaskForm(false);
      await onRefreshAppState?.();
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsAddingTask(false);
    }
  };

  const handleCancelTask = () => {
    setNewTaskText('');
    setNewTaskStatus('blocked');
    setNewTaskResponsibility('');
    setNewTaskDueDate('');
    setNewTaskBlockSubmission(false);
    setShowAddTaskForm(false);
  };

  const handleStartTaskOverride = (task: Task) => {
    setOverrideTaskId(task.id);
    setOverrideTaskStatus(task.taskStatus ?? (task.completed ? 'completed' : 'in-progress'));
    setOverrideTaskRationale(task.justification ?? '');
  };

  const handleSaveTaskOverride = async (taskId: string, grantId?: string) => {
    if (!overrideTaskRationale.trim()) return;

    if (grantId) {
      // Use the grant override API to record human override with audit trail
      await grantsApi.override(grantId, {
        field: `task.${taskId}.status` as const,
        newValue: overrideTaskStatus,
        rationale: overrideTaskRationale.trim(),
        overrideType: 'task',
      });
    } else {
      // Fall back to task-specific override API for tasks without grantId
      await tasksApi.override(taskId, {
        newValue: overrideTaskStatus,
        rationale: overrideTaskRationale.trim(),
        overrideType: 'task',
      });
    }

    // Update local state to reflect the override
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              taskStatus: overrideTaskStatus,
              justification: overrideTaskRationale.trim(),
              completed: overrideTaskStatus === 'completed',
            }
          : task,
      ),
    );
    setOverrideTaskId(null);
    setOverrideTaskRationale('');
    await onRefreshAppState?.();
  };

  const handleCancelTaskOverride = () => {
    setOverrideTaskId(null);
    setOverrideTaskRationale('');
  };

  if (loading) {
    return <div className="header-title" role="status" aria-busy="true" aria-label="Loading tasks">Loading...</div>;
  }

  if (tasks.length === 0 && followUps.length === 0) {
    return (
      <>
        <div className="header">
          <div>
            <h1 className="header-title">
              Tasks <span className="accent">To-do</span>
            </h1>
            <div className="header-sub">No tasks</div>
          </div>
        </div>
        <div className="empty-state-guide" data-testid="tasks-empty-state">
          <div className="empty-state-title">No tasks yet</div>
          <div className="empty-state-description">
            Tasks appear here when you add grants to your pipeline.
          </div>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate?.('pipeline')} aria-label="Go to Pipeline">
              View Pipeline
            </button>
            <button type="button" className="btn" onClick={() => onNavigate?.('discovery')} aria-label="Go to Discovery">
              Discover grants
            </button>
          </div>
        </div>
      </>
    );
  }

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <>
      <div className="header">
        <div>
          <h1 className="header-title">
            Tasks <span className="accent">To-do</span>
          </h1>
          <div className="header-sub">
            {completedCount} of {tasks.length} completed
          </div>
        </div>
        <div className="header-actions">
          {showAddTaskForm ? (
            <form onSubmit={handleSubmitTask} className="add-task-inline">
              <input
                type="text"
                placeholder="Enter new task..."
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                disabled={isAddingTask}
              />
              <select
                value={newTaskStatus}
                onChange={(e) => setNewTaskStatus(e.target.value as TaskStatus)}
                disabled={isAddingTask}
              >
                <option value="blocked">blocked</option>
                <option value="in-progress">in-progress</option>
                <option value="completed">completed</option>
                <option value="waived">waived</option>
                <option value="not-applicable">not-applicable</option>
              </select>
              <select
                value={newTaskResponsibility}
                onChange={(e) => setNewTaskResponsibility(e.target.value as ResponsibilityTag | '')}
                disabled={isAddingTask}
              >
                <option value="">No assignment</option>
                <option value="finance">Finance</option>
                <option value="program">Program</option>
                <option value="review">Review</option>
                <option value="follow-up">Follow-up</option>
              </select>
              <input
                type="date"
                placeholder="Due date"
                value={newTaskDueDate}
                onChange={(e) => setNewTaskDueDate(e.target.value)}
                disabled={isAddingTask}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={newTaskBlockSubmission}
                  onChange={(e) => setNewTaskBlockSubmission(e.target.checked)}
                  disabled={isAddingTask}
                />
                Blocks submission
              </label>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isAddingTask || !newTaskText.trim()}
              >
                {isAddingTask ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCancelTask}
                disabled={isAddingTask}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button type="button" className="btn btn-primary" onClick={handleAddTask}>
              + Add task
            </button>
          )}
        </div>
      </div>
      <div className="tasks-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => handleToggleTask(task.id)}
              className="task-checkbox"
            />
            <div className="task-text">
              <div>{task.text}</div>
              <div className="task-meta">
                {task.taskStatus && <span className="task-badge">{task.taskStatus}</span>}
                {task.responsibilityTag && <span className="task-badge">{task.responsibilityTag}</span>}
                {task.blockSubmission && <span className="task-badge">Blocks submission</span>}
              </div>
              {task.justification && <div className="task-rationale">Rationale: {task.justification}</div>}
              <button type="button" data-testid="task-override-btn" onClick={() => handleStartTaskOverride(task)}>
                Override
              </button>
              {overrideTaskId === task.id && (
                <div className="task-override-panel">
                  <select value={overrideTaskStatus} onChange={(e) => setOverrideTaskStatus(e.target.value as TaskStatus)}>
                    <option value="blocked">blocked</option>
                    <option value="in-progress">in-progress</option>
                    <option value="completed">completed</option>
                    <option value="waived">waived</option>
                    <option value="not-applicable">not-applicable</option>
                  </select>
                  <textarea
                    placeholder="Rationale"
                    value={overrideTaskRationale}
                    onChange={(e) => setOverrideTaskRationale(e.target.value)}
                  />
                  <div>
                    <button type="button" onClick={() => void handleSaveTaskOverride(task.id, task.grantId)} disabled={!overrideTaskRationale.trim()}>
                      Save override
                    </button>
                    <button type="button" onClick={handleCancelTaskOverride}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {followUps.length > 0 && (
        <div className="followups-section">
          <div className="section-heading">Follow-ups</div>
          {followUps.map((fu) => (
            <div key={fu.id} className={`followup-item ${fu.status}`}>
              <input type="checkbox" checked={fu.status === 'completed'} onChange={() => { void handleToggleFollowUp(fu.id); }} className="task-checkbox" />
              <div className="followup-info">
                <span className="followup-type">{fu.type.replace(/_/g, ' ')}</span>
                <div className="followup-title">{fu.title}</div>
                {fu.dueDate && (<div className="followup-due">Due: {new Date(fu.dueDate).toLocaleDateString()}</div>)}
              </div>
              <div className={`followup-status ${fu.status}`}>{fu.status}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
