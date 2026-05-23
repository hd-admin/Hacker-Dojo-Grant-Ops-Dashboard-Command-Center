'use client';

import { useState, useEffect } from 'react';
import type { Task } from '../../../shared/types';
import { seedTasks } from '../../../shared/seed-data';
import { tasksApi } from '../lib/grant-ops-client';

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [loading, setLoading] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await tasksApi.getAll();
        setTasks(data);
      } catch (error) {
        console.error('Error loading tasks:', error);
        setTasks([]);
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

  if (tasks.length === 0) {
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
                autoFocus
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
            <button className="btn btn-primary" onClick={handleAddTask}>
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
    </>
  );
}
