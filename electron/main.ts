import { app, BrowserWindow, nativeImage, Menu } from 'electron';
import path from 'path';
import { initTray } from './tray';
import { initAutoUpdater } from './updater';
import { registerIpcHandlers } from './ipc-handlers';
import log from 'electron-log';
import Store from 'electron-store';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// Window state store
const store = new Store<{ windowState?: { x: number; y: number; width: number; height: number } }>({
  name: 'window-state',
});

const createWindow = () => {
  log.info('Creating main window...');

  // Restore window state
  const windowState = store.get('windowState');

  mainWindow = new BrowserWindow({
    width: windowState?.width ?? 1200,
    height: windowState?.height ?? 800,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Save window state on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowState', bounds);
    }
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

  // macOS app menu bar
  const menu = Menu.buildFromTemplate([
    { label: `About ${app.name}` },
    { type: 'separator' },
    { label: 'Preferences...' },
    { type: 'separator' },
    { label: 'Quit' },
  ]);
  Menu.setApplicationMenu(menu);

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
