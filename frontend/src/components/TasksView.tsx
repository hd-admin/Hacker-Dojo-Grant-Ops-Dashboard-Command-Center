'use client';

import { useState, useEffect } from 'react';
import type { Task } from '../../../shared/types';
import { mockTasks, isElectronAPIavailable } from '../lib/mockData';

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        if (isElectronAPIavailable()) {
          const data = await window.electronAPI.getTasks();
          setTasks(data);
        } else {
          setTasks(mockTasks);
        }
      } catch (error) {
        console.error('Error loading tasks:', error);
        setTasks(mockTasks);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleToggleTask = async (taskId: string) => {
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updatedTasks);
    await window.electronAPI.updateTasks(updatedTasks);
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
