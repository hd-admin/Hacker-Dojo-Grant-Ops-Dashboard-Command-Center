import { ipcMain, app, dialog } from 'electron';
import log from 'electron-log';
import { store } from './store';
import { GrantStatus, ActivityEvent } from '../shared/types';
import fs from 'fs';
import path from 'path';

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

  // Crawl handlers
  ipcMain.handle('crawl:getStatus', async () => {
    try {
      return store.getCrawlStatus();
    } catch (error) {
      log.error('Error getting crawl status:', error);
      return { online: false, lastSync: new Date().toISOString() };
    }
  });

  ipcMain.handle('crawl:trigger', async () => {
    log.info('Crawl trigger requested');
    // Update lastSync to now
    store.updateCrawlStatus({ online: true, lastSync: new Date().toISOString() });
    return true;
  });

  // Notification handlers
  ipcMain.handle('notifications:get', async () => {
    try {
      return store.getNotifications();
    } catch (error) {
      log.error('Error getting notifications:', error);
      return [];
    }
  });

  ipcMain.handle('notifications:update', async (_, notifications) => {
    try {
      store.updateNotifications(notifications);
      return true;
    } catch (error) {
      log.error('Error updating notifications:', error);
      return false;
    }
  });

  // Task handlers
  ipcMain.handle('tasks:get', async () => {
    try {
      return store.getTasks();
    } catch (error) {
      log.error('Error getting tasks:', error);
      return [];
    }
  });

  ipcMain.handle('tasks:update', async (_, tasks) => {
    try {
      store.updateTasks(tasks);
      return true;
    } catch (error) {
      log.error('Error updating tasks:', error);
      return false;
    }
  });

  // Document handlers
  ipcMain.handle('documents:upload', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Documents', extensions: ['pdf', 'xls', 'xlsx', 'doc', 'docx'] },
        ],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const sourcePath = result.filePaths[0];
      const fileName = path.basename(sourcePath);
      const ext = path.extname(fileName).toLowerCase().replace('.', '');
      const docType = ext === 'pdf' ? 'PDF' : ext === 'xls' || ext === 'xlsx' ? 'XLS' : 'DOC';

      // Copy file to app userData/documents directory
      const docsDir = path.join(app.getPath('userData'), 'documents');
      if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
      }
      const destPath = path.join(docsDir, fileName);

      // If file already exists, append a timestamp
      let finalDest = destPath;
      if (fs.existsSync(destPath)) {
        const timestamp = Date.now();
        const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
        finalDest = path.join(docsDir, `${nameWithoutExt}_${timestamp}.${ext}`);
      }

      fs.copyFileSync(sourcePath, finalDest);

      const doc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: fileName,
        type: docType,
        lastUsed: new Date().toISOString(),
      };

      store.addDocument(doc);
      return doc;
    } catch (error) {
      log.error('Error uploading document:', error);
      return null;
    }
  });

  ipcMain.handle('documents:getAll', async () => {
    try {
      return store.getDocuments();
    } catch (error) {
      log.error('Error getting documents:', error);
      return [];
    }
  });

  // Theme handlers
  ipcMain.handle('themes:add', async (_, theme: string) => {
    try {
      const profile = store.getProfile();
      if (!profile.searchThemes.includes(theme)) {
        profile.searchThemes.push(theme);
        store.updateProfile(profile);
      }
      return true;
    } catch (error) {
      log.error('Error adding theme:', error);
      return false;
    }
  });

  ipcMain.handle('themes:remove', async (_, theme: string) => {
    try {
      const profile = store.getProfile();
      profile.searchThemes = profile.searchThemes.filter((t) => t !== theme);
      store.updateProfile(profile);
      return true;
    } catch (error) {
      log.error('Error removing theme:', error);
      return false;
    }
  });

  // Activity handlers
  ipcMain.handle('activity:getRecent', async (_, count: number) => {
    try {
      return store.getRecentActivity(count);
    } catch (error) {
      log.error('Error getting recent activity:', error);
      return [];
    }
  });

  log.info('IPC handlers registered');
};
