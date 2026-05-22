import { ipcMain, app } from 'electron';
import log from 'electron-log';
import { store } from './store';
import { GrantStatus } from '../shared/types';

export const registerIpcHandlers = () => {
  log.info('Registering IPC handlers...');

  ipcMain.handle('grants:getAll', async () => {
    try {
      return store.getGrants();
    } catch (error) {
      log.error('Error getting grants:', error);
      return [];
    }
  });

  ipcMain.handle('grants:getById', async (_, id: string) => {
    try {
      return store.getGrant(id);
    } catch (error) {
      log.error('Error getting grant by id:', error);
      return null;
    }
  });

  ipcMain.handle('grants:updateStatus', async (_, id: string, status: GrantStatus) => {
    try {
      store.updateGrant(id, { status });
      return true;
    } catch (error) {
      log.error('Error updating grant status:', error);
      return false;
    }
  });

  ipcMain.handle('grants:addGrant', async (_, grant) => {
    try {
      store.addGrant(grant);
      return true;
    } catch (error) {
      log.error('Error adding grant:', error);
      return false;
    }
  });

  ipcMain.handle('org:getProfile', async () => {
    try {
      return store.getProfile();
    } catch (error) {
      log.error('Error getting org profile:', error);
      return null;
    }
  });

  ipcMain.handle('org:updateProfile', async (_, profile) => {
    try {
      store.updateProfile(profile);
      return true;
    } catch (error) {
      log.error('Error updating org profile:', error);
      return false;
    }
  });

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion();
  });

  ipcMain.handle('app:quit', async () => {
    app.quit();
  });

  log.info('IPC handlers registered');
};
