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
  onRefreshCrawl: (callback: () => void) => {
    ipcRenderer.on('refresh-crawl', () => callback());
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
  // Desktop notifications
  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notifications:show', title, body),
  // Sources (new)
  getSources: () => ipcRenderer.invoke('sources:getAll'),
  addSource: (source) => ipcRenderer.invoke('sources:add', source),
  removeSource: (id: string) => ipcRenderer.invoke('sources:remove', id),
  // Draft operations (new)
  getDraftArtifacts: (grantId: string) => ipcRenderer.invoke('drafts:get', grantId),
  createDraftArtifact: (artifact) => ipcRenderer.invoke('drafts:create', artifact),
  // Revision requests (new)
  getRevisionRequests: (grantId: string) => ipcRenderer.invoke('revisions:get', grantId),
  createRevisionRequest: (request) => ipcRenderer.invoke('revisions:create', request),
  // Approval records (new)
  getApprovalRecord: (grantId: string) => ipcRenderer.invoke('approvals:get', grantId),
  createApprovalRecord: (record) => ipcRenderer.invoke('approvals:create', record),
  // Submission records (new)
  getSubmissionRecord: (grantId: string) => ipcRenderer.invoke('submissions:get', grantId),
  createSubmissionRecord: (record) => ipcRenderer.invoke('submissions:create', record),
  // Follow-ups (new)
  getFollowUps: () => ipcRenderer.invoke('followUps:getAll'),
  createFollowUp: (followUp) => ipcRenderer.invoke('followUps:create', followUp),
  updateFollowUp: (followUp) => ipcRenderer.invoke('followUps:update', followUp),
  // Opencode settings (new)
  getOpencodeSettings: () => ipcRenderer.invoke('opencode:getSettings'),
  updateOpencodeSettings: (settings) => ipcRenderer.invoke('opencode:updateSettings', settings),
  // Research/Crawl runs (new)
  getCrawlRuns: () => ipcRenderer.invoke('crawlRuns:getAll'),
  getLatestCrawlRun: () => ipcRenderer.invoke('crawlRuns:getLatest'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
