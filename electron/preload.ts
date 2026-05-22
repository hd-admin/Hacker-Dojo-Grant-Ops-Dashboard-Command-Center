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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
