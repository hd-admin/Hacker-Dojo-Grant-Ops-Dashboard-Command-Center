'use client';

import React from 'react';
import { useEffect, useState } from 'react';
import type { Task, FollowUp } from '../../../shared/types';
import { tasksApi, followUpsApi } from '../lib/grant-ops-client';

interface TasksViewProps {
  onRefreshAppState?: () => Promise<void> | void;
  tasks?: Task[];
}

export default function TasksView({ onRefreshAppState, tasks: tasksProp }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>(tasksProp ?? []);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

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
      const newTask = await tasksApi.create({
        completed: false,
        text: newTaskText.trim(),
      });
      setTasks((prev) => [...prev, newTask]);
      setNewTaskText('');
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
    setShowAddTaskForm(false);
  };

  if (loading) {
    return <div className="header-title">Loading...</div>;
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
        <div className="empty-state">
          <p>No tasks yet.</p>
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
            <div className="task-text">{task.text}</div>
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
