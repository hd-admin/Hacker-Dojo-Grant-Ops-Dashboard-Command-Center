import { Tray, Menu, nativeImage, app, NativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';
import { showWindow, getMainWindow } from './main';
import { autoUpdater } from 'electron-updater';

let tray: Tray | null = null;

export const initTray = () => {
  log.info('Initializing system tray...');

  // Create a simple icon - in production this would be a proper icon file
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(__dirname, '..', 'assets', 'icon.png');

  // Create a fallback icon if the file doesn't exist
  let icon: NativeImage;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      // Create a simple colored square as fallback
      icon = nativeImage.createFromBuffer(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABpSURBVFhH7c0xDQAgCARA+t3zHiwJNhgk2i5wBfZxdHMBEhYiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi8ncF7sKlH1l5xCUAAAAASUVORK5CYII=',
          'base64'
        )
      );
    }
  } catch {
    // Create a simple colored square as fallback
    icon = nativeImage.createFromBuffer(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABpSURBVFhH7c0xDQAgCARA+t3zHiwJNhgk2i5wBfZxdHMBEhYiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi8ncF7sKlH1l5xCUAAAAASUVORK5CYII=',
        'base64'
      )
    );
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Hacker Dojo Grant Ops');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        showWindow();
      },
    },
    {
      label: 'Refresh Crawl',
      click: () => {
        log.info('Refresh crawl requested');
        const win = getMainWindow();
        if (win) {
          win.webContents.send('refresh-crawl');
        }
      },
    },
    {
      label: 'Check for Updates',
      click: () => {
        log.info('Checking for updates...');
        autoUpdater.checkForUpdates().catch((err) => {
          log.error('Failed to check for updates:', err);
        });
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    showWindow();
  });

  log.info('System tray initialized');
};
