import { app, BrowserWindow, nativeImage } from 'electron';
import path from 'path';
import { initTray } from './tray';
import { initAutoUpdater } from './updater';
import { registerIpcHandlers } from './ipc-handlers';
import log from 'electron-log';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const createWindow = () => {
  log.info('Creating main window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  log.info(`Loading URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    setTimeout(() => {
      mainWindow?.show();
      log.info('Window shown');
    }, 100);
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      log.info('Window hidden to tray');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

export const getMainWindow = () => mainWindow;

export const showWindow = () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
};

app.whenReady().then(() => {
  log.info('App ready, initializing...');
  registerIpcHandlers();
  createWindow();
  initTray();
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  log.info('App quitting...');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
