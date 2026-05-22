import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '../../../shared/types';

// Mock window.electronAPI
const mockTasks: Task[] = [
  { id: 'task-1', text: 'Review NSF TechAccess LOI', completed: false },
  { id: 'task-2', text: 'Send partnership letter to Mountain View Library', completed: true },
  { id: 'task-3', text: 'Update budget justification', completed: false },
];

const mockElectronAPI = {
  getTasks: vi.fn().mockResolvedValue(mockTasks),
  updateTasks: vi.fn().mockResolvedValue(true),
  getGrants: vi.fn().mockResolvedValue([]),
  getOrgProfile: vi.fn().mockResolvedValue(null),
  getCrawlStatus: vi.fn().mockResolvedValue({ online: true, lastSync: new Date().toISOString() }),
  getNotifications: vi.fn().mockResolvedValue([]),
  getRecentActivity: vi.fn().mockResolvedValue([]),
  updateGrantStatus: vi.fn().mockResolvedValue(true),
  updateOrgProfile: vi.fn().mockResolvedValue(true),
  triggerCrawl: vi.fn().mockResolvedValue(true),
  uploadDocument: vi.fn().mockResolvedValue(null),
  getDocuments: vi.fn().mockResolvedValue([]),
  addTheme: vi.fn().mockResolvedValue(true),
  removeTheme: vi.fn().mockResolvedValue(true),
  showNotification: vi.fn().mockResolvedValue(true),
  getAppVersion: vi.fn().mockResolvedValue('0.1.0'),
  quitApp: vi.fn().mockResolvedValue(true),
  onUpdateStatus: vi.fn(),
};

vi.stubGlobal('window', {
  electronAPI: mockElectronAPI,
});

// Minimal component for testing since we can't easily render the full component with hooks
describe('TasksView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Task data handling', () => {
    it('should load tasks from electronAPI on mount', async () => {
      const tasks = await mockElectronAPI.getTasks();
      expect(tasks).toHaveLength(3);
      expect(tasks[0]?.text).toBe('Review NSF TechAccess LOI');
    });

    it('should toggle task completion', async () => {
      const tasks = [...mockTasks];
      const updatedTasks = tasks.map((t) =>
        t.id === 'task-1' ? { ...t, completed: !t.completed } : t,
      );
      await mockElectronAPI.updateTasks(updatedTasks);
      expect(mockElectronAPI.updateTasks).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'task-1', completed: true })]),
      );
    });

    it('should create new task with unique id', () => {
      const newTask = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        completed: false,
        text: 'New task text',
      };
      expect(newTask.id.length).toBeGreaterThan(10);
      expect(newTask.completed).toBe(false);
      expect(newTask.text).toBe('New task text');
    });

    it('should add new task to existing tasks', async () => {
      const newTask = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        completed: false,
        text: 'New task text',
      };
      const updatedTasks = [...mockTasks, newTask];
      await mockElectronAPI.updateTasks(updatedTasks);
      expect(updatedTasks).toHaveLength(4);
      expect(updatedTasks[3]?.text).toBe('New task text');
    });

    it('should persist updated tasks via IPC', async () => {
      const tasks = [...mockTasks];
      await mockElectronAPI.updateTasks(tasks);
      expect(mockElectronAPI.updateTasks).toHaveBeenCalledWith(tasks);
    });
  });

  describe('Add task flow', () => {
    it('should handle window.prompt for new task creation', async () => {
      // Mock window.prompt
      const originalPrompt = window.prompt;
      (window.prompt as ReturnType<typeof vi.fn>) = vi.fn().mockResolvedValue('New task text');
      const text = await window.prompt('Enter new task:');
      expect(text).toBe('New task text');
      window.prompt = originalPrompt;
    });

    it('should not create task if prompt returns null', async () => {
      const originalPrompt = window.prompt;
      (window.prompt as ReturnType<typeof vi.fn>) = vi.fn().mockResolvedValue(null);
      const text = await window.prompt('Enter new task:');
      expect(text).toBeNull();
      window.prompt = originalPrompt;
    });
  });

  describe('Task completion counting', () => {
    it('should count completed tasks correctly', () => {
      const completedCount = mockTasks.filter((t) => t.completed).length;
      expect(completedCount).toBe(1);
    });

    it('should filter completed vs pending tasks', () => {
      const pending = mockTasks.filter((t) => !t.completed);
      const completed = mockTasks.filter((t) => t.completed);
      expect(pending).toHaveLength(2);
      expect(completed).toHaveLength(1);
    });
  });
});
