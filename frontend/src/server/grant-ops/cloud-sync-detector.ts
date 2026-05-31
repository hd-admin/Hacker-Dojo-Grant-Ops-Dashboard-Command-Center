import fs from 'node:fs';
import path from 'node:path';

export interface CloudSyncCheck {
  isCloudSynced: boolean;
  service?: string;
}

export function detectCloudSync(dataDir: string): CloudSyncCheck {
  // Check for Dropbox
  if (fs.existsSync(path.join(dataDir, '.dropbox')) || fs.existsSync(path.join(path.dirname(dataDir), '.dropbox'))) {
    return { isCloudSynced: true, service: 'Dropbox' };
  }

  // Check for Google Drive
  if (fs.existsSync(path.join(dataDir, 'desktop.ini'))) {
    const content = fs.readFileSync(path.join(dataDir, 'desktop.ini'), 'utf8');
    if (content.includes('Google Drive')) {
      return { isCloudSynced: true, service: 'Google Drive' };
    }
  }

  // Check for iCloud
  if (fs.existsSync(path.join(dataDir, '.DS_Store'))) {
    return { isCloudSynced: true, service: 'iCloud' };
  }

  // Check for OneDrive
  if (fs.existsSync(path.join(path.dirname(dataDir), 'OneDrive')) || fs.existsSync(path.join(path.dirname(dataDir), 'OneDrive - '))) {
    return { isCloudSynced: true, service: 'OneDrive' };
  }

  return { isCloudSynced: false };
}
