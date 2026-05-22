import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { getMainWindow } from './main';

export const initAutoUpdater = () => {
  log.info('Initializing auto-updater...');

  autoUpdater.logger = log;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const sendStatusToWindow = (status: string) => {
    const win = getMainWindow();
    if (win) {
      win.webContents.send('update-status', status);
    }
  };

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    sendStatusToWindow('checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    sendStatusToWindow('available');
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
    sendStatusToWindow('not-available');
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    sendStatusToWindow('error');
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log.info('Download progress:', progressObj.percent);
    sendStatusToWindow('downloading');
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    sendStatusToWindow('downloaded');
  });

  // Check for updates after a delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Failed to check for updates:', err);
    });
  }, 3000);
};
