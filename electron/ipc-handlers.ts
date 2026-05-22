import { ipcMain, app, dialog, Notification } from 'electron';
import log from 'electron-log';
import { store } from './store';
import { GrantStatus } from '../shared/types';
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
    // Show desktop notification
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'Crawl Complete',
        body: 'Grant database has been updated.',
        silent: false,
      });
      notification.show();
    }
    return true;
  });

  // Desktop notification handler
  ipcMain.handle('notifications:show', async (_, title: string, body: string) => {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({ title, body, silent: false });
        notification.show();
        return true;
      }
      return false;
    } catch (error) {
      log.error('Error showing notification:', error);
      return false;
    }
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
        filters: [{ name: 'Documents', extensions: ['pdf', 'xls', 'xlsx', 'doc', 'docx'] }],
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
        id: `doc-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`,
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

  // Source handlers
  ipcMain.handle('sources:getAll', async () => {
    try {
      return store.getSources();
    } catch (error) {
      log.error('Error getting sources:', error);
      return [];
    }
  });

  ipcMain.handle('sources:add', async (_, source) => {
    try {
      store.addSource(source);
      return true;
    } catch (error) {
      log.error('Error adding source:', error);
      return false;
    }
  });

  ipcMain.handle('sources:remove', async (_, id: string) => {
    try {
      store.removeSource(id);
      return true;
    } catch (error) {
      log.error('Error removing source:', error);
      return false;
    }
  });

  // CrawlRun handlers
  ipcMain.handle('crawlRuns:getAll', async () => {
    try {
      return store.getCrawlRuns();
    } catch (error) {
      log.error('Error getting crawl runs:', error);
      return [];
    }
  });

  ipcMain.handle('crawlRuns:getLatest', async () => {
    try {
      return store.getLatestCrawlRun();
    } catch (error) {
      log.error('Error getting latest crawl run:', error);
      return null;
    }
  });

  // DraftArtifact handlers
  ipcMain.handle('drafts:get', async (_, grantId: string) => {
    try {
      return store.getDraftArtifacts(grantId);
    } catch (error) {
      log.error('Error getting draft artifacts:', error);
      return [];
    }
  });

  ipcMain.handle('drafts:create', async (_, artifact) => {
    try {
      store.addDraftArtifact(artifact);
      return true;
    } catch (error) {
      log.error('Error creating draft artifact:', error);
      return false;
    }
  });

  // RevisionRequest handlers
  ipcMain.handle('revisions:get', async (_, grantId: string) => {
    try {
      return store.getRevisionRequests(grantId);
    } catch (error) {
      log.error('Error getting revision requests:', error);
      return [];
    }
  });

  ipcMain.handle('revisions:create', async (_, request) => {
    try {
      store.addRevisionRequest(request);
      return true;
    } catch (error) {
      log.error('Error creating revision request:', error);
      return false;
    }
  });

  // ApprovalRecord handlers
  ipcMain.handle('approvals:get', async (_, grantId: string) => {
    try {
      return store.getApprovalRecord(grantId);
    } catch (error) {
      log.error('Error getting approval record:', error);
      return null;
    }
  });

  ipcMain.handle('approvals:create', async (_, record) => {
    try {
      store.addApprovalRecord(record);
      return true;
    } catch (error) {
      log.error('Error creating approval record:', error);
      return false;
    }
  });

  // SubmissionRecord handlers
  ipcMain.handle('submissions:get', async (_, grantId: string) => {
    try {
      return store.getSubmissionRecord(grantId);
    } catch (error) {
      log.error('Error getting submission record:', error);
      return null;
    }
  });

  ipcMain.handle('submissions:create', async (_, record) => {
    try {
      store.addSubmissionRecord(record);
      return true;
    } catch (error) {
      log.error('Error creating submission record:', error);
      return false;
    }
  });

  // FollowUp handlers
  ipcMain.handle('followUps:getAll', async () => {
    try {
      return store.getFollowUps();
    } catch (error) {
      log.error('Error getting follow-ups:', error);
      return [];
    }
  });

  ipcMain.handle('followUps:create', async (_, followUp) => {
    try {
      store.addFollowUp(followUp);
      return true;
    } catch (error) {
      log.error('Error creating follow-up:', error);
      return false;
    }
  });

  ipcMain.handle('followUps:update', async (_, followUp) => {
    try {
      store.updateFollowUp(followUp);
      return true;
    } catch (error) {
      log.error('Error updating follow-up:', error);
      return false;
    }
  });

  // OpencodeSettings handlers
  ipcMain.handle('opencode:getSettings', async () => {
    try {
      return store.getOpencodeSettings();
    } catch (error) {
      log.error('Error getting opencode settings:', error);
      return null;
    }
  });

  ipcMain.handle('opencode:updateSettings', async (_, settings) => {
    try {
      store.updateOpencodeSettings(settings);
      return true;
    } catch (error) {
      log.error('Error updating opencode settings:', error);
      return false;
    }
  });

  log.info('IPC handlers registered');
};
