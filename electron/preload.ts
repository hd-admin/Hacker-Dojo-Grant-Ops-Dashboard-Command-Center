import { contextBridge, ipcRenderer } from 'electron';
import { GrantStatus, ElectronAPI } from '../shared/types';

const electronAPI: ElectronAPI = {
  getGrants: () => ipcRenderer.invoke('grants:getAll'),
  getGrantById: (id: string) => ipcRenderer.invoke('grants:getById', id),
  updateGrantStatus: (id: string, status: GrantStatus) =>
    ipcRenderer.invoke('grants:updateStatus', id, status),
  addGrant: (grant) => ipcRenderer.invoke('grants:addGrant', grant),
  getOrgProfile: () => ipcRenderer.invoke('org:getProfile'),
  updateOrgProfile: (profile) => ipcRenderer.invoke('org:updateProfile', profile),
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  onUpdateStatus: (callback: (status: string) => void) => {
    ipcRenderer.on('update-status', (_, status) => callback(status));
  },
  // Crawl
  getCrawlStatus: () => ipcRenderer.invoke('crawl:getStatus'),
  triggerCrawl: () => ipcRenderer.invoke('crawl:trigger'),
  // Notifications
  getNotifications: () => ipcRenderer.invoke('notifications:get'),
  updateNotifications: (notifications) => ipcRenderer.invoke('notifications:update', notifications),
  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:get'),
  updateTasks: (tasks) => ipcRenderer.invoke('tasks:update', tasks),
  // Documents
  uploadDocument: () => ipcRenderer.invoke('documents:upload'),
  getDocuments: () => ipcRenderer.invoke('documents:getAll'),
  // Themes
  addTheme: (theme: string) => ipcRenderer.invoke('themes:add', theme),
  removeTheme: (theme: string) => ipcRenderer.invoke('themes:remove', theme),
  // Activity
  getRecentActivity: (count: number) => ipcRenderer.invoke('activity:getRecent', count),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
