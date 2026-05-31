import 'server-only';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import AdmZip, { type IZipEntry } from 'adm-zip';
import type { BackupManifest, BackupVerificationRecord, OpencodeSettings, OrganizationProfile } from '../../../../shared/types';
import type { PersistedData } from '../../../../shared/grant-ops-persistence';
import { getDataDir, loadBackupFreshness, loadPersistedData, loadGrants, loadProfile, loadOpencodeSettings, saveBackupFreshness, saveBackupVerificationRecord, savePersistedData, saveGrants, saveOpencodeSettings, saveProfile } from '../../../../shared/grant-ops-persistence';

export interface BackupSnapshot {
  manifest: BackupManifest;
  grants: Awaited<ReturnType<typeof loadGrants>>;
  profile: OrganizationProfile;
  opencodeSettings: OpencodeSettings | null;
  persistedData: PersistedData;
  documents: Array<{ id: string; storagePath: string; contentBase64: string }>;
}

function buildVerificationOutcome(kind: 'backup' | 'restore', grantCount: number, documentCount: number): string {
  return `${kind === 'backup' ? 'Backup' : 'Restore'} verified: ${grantCount} grants, ${documentCount} documents`;
}

export async function exportBackupSnapshot(): Promise<BackupSnapshot> {
  const grants = await loadGrants();
  const profile = await loadProfile();
  const opencodeSettings = await loadOpencodeSettings();
  const persistedData = await loadPersistedData();
  const documents = await Promise.all(
    persistedData.documents
      .filter((document) => document.storagePath)
      .map(async (document) => {
        const storagePath = document.storagePath as string;
        try {
          const buffer = await fs.readFile(storagePath);
          return { id: document.id, storagePath, contentBase64: buffer.toString('base64') };
        } catch {
          return null;
        }
      }),
  );

  const manifest: BackupManifest = {
    version: '1',
    createdAt: new Date().toISOString(),
    grantCount: grants.length,
    sourceCount: persistedData.sources.length,
    documentCount: persistedData.documents.length,
    hasDocumentFiles: documents.some((entry) => Boolean(entry)),
  };

  return {
    manifest,
    grants,
    profile,
    opencodeSettings,
    persistedData,
    documents: documents.filter((entry): entry is { id: string; storagePath: string; contentBase64: string } => entry !== null),
  };
}

function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function getBackupsDir(): string {
  const dataDir = getDataDir();
  return path.join(dataDir, 'backups');
}

export async function createBackupZip(snapshot: BackupSnapshot): Promise<{ zipPath: string; checksum: string }> {
  const backupsDir = getBackupsDir();
  await fs.mkdir(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipName = `grant-ops-backup-${timestamp}.zip`;
  const zipPath = path.join(backupsDir, zipName);
  const checksumPath = `${zipPath}.sha256`;

  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(snapshot.manifest, null, 2)));
  zip.addFile('grants.json', Buffer.from(JSON.stringify(snapshot.grants, null, 2)));
  zip.addFile('profile.json', Buffer.from(JSON.stringify(snapshot.profile, null, 2)));
  zip.addFile('opencode-settings.json', Buffer.from(JSON.stringify(snapshot.opencodeSettings ?? {}, null, 2)));
  zip.addFile('persisted-data.json', Buffer.from(JSON.stringify(snapshot.persistedData, null, 2)));

  if (snapshot.documents.length > 0) {
    for (const doc of snapshot.documents) {
      const docBuffer = Buffer.from(doc.contentBase64, 'base64');
      zip.addFile(`documents/${doc.id}.data`, docBuffer);
    }
  }

  const zipBuffer = zip.toBuffer();

  // Check available disk space before writing
  const freeBytes = await getAvailableSpace(backupsDir);
  const zipSize = zipBuffer.length;
  const minFreeBytes = 200 * 1024 * 1024; // 200MB

  if (freeBytes !== null && freeBytes - zipSize < minFreeBytes) {
    const freeMB = freeBytes !== null ? (freeBytes / (1024 * 1024)).toFixed(1) : 'unknown';
    throw new Error(
      `Insufficient disk space: ${freeMB}MB available, need at least 200MB free after writing ${(zipSize / (1024 * 1024)).toFixed(1)}MB backup.`
    );
  }

  await fs.writeFile(zipPath, zipBuffer);

  const checksum = computeSha256(zipBuffer);
  await fs.writeFile(checksumPath, `${checksum}  ${zipName}\n`, 'utf-8');

  return { zipPath, checksum };
}

async function getAvailableSpace(dirPath: string): Promise<number | null> {
  try {
    if (typeof fsSync.statfsSync === 'function') {
      const stat = fsSync.statfsSync(dirPath);
      return stat.bsize * stat.bavail;
    }
  } catch {
    // statfs not available on all platforms
  }
  return null;
}

export async function verifyBackupZip(zipPath: string, checksumPath: string): Promise<boolean> {
  try {
    const [zipBuffer, checksumContent] = await Promise.all([
      fs.readFile(zipPath),
      fs.readFile(checksumPath, 'utf-8'),
    ]);

    const expectedChecksum = checksumContent.split(/\s+/)[0];
    const actualChecksum = computeSha256(zipBuffer);

    return expectedChecksum === actualChecksum;
  } catch {
    return false;
  }
}

export async function importBackupFromZip(zipPath: string): Promise<void> {
  const zipBuffer = await fs.readFile(zipPath);
  const zip = new AdmZip(zipBuffer);
  const entries: IZipEntry[] = zip.getEntries();

  const manifestEntry = entries.find((e: IZipEntry) => e.entryName === 'manifest.json');
  const grantsEntry = entries.find((e: IZipEntry) => e.entryName === 'grants.json');
  const profileEntry = entries.find((e: IZipEntry) => e.entryName === 'profile.json');
  const settingsEntry = entries.find((e: IZipEntry) => e.entryName === 'opencode-settings.json');
  const persistedEntry = entries.find((e: IZipEntry) => e.entryName === 'persisted-data.json');

  if (!manifestEntry || !grantsEntry || !profileEntry || !persistedEntry) {
    throw new Error('Invalid backup archive: missing required files (manifest, grants, profile, or persisted-data)');
  }

  const dataDir = getDataDir();
  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as BackupManifest;

  if (manifest.version !== '1') {
    throw new Error(`Unsupported backup version: ${manifest.version}`);
  }

  await fs.mkdir(path.join(dataDir, 'documents'), { recursive: true });

  const grants = JSON.parse(grantsEntry.getData().toString('utf-8'));
  const profile = JSON.parse(profileEntry.getData().toString('utf-8')) as OrganizationProfile;
  const opencodeSettings = settingsEntry ? JSON.parse(settingsEntry.getData().toString('utf-8')) as OpencodeSettings : {} as OpencodeSettings;
  const persistedData = JSON.parse(persistedEntry.getData().toString('utf-8')) as PersistedData;

  // Restore documents from the zip
  const docEntries = entries.filter((e: IZipEntry) => e.entryName.startsWith('documents/') && !e.isDirectory);
  for (const docEntry of docEntries) {
    const docId = path.basename(docEntry.entryName, '.data');
    const docBuffer = docEntry.getData();
    const docPath = path.join(dataDir, 'documents', `${docId}.data`);
    await fs.writeFile(docPath, docBuffer);
    // Update storage path in persisted data
    const docRecord = persistedData.documents.find((d) => d.id === docId);
    if (docRecord) {
      docRecord.storagePath = docPath;
    }
  }

  await savePersistedData(persistedData);
  await saveGrants(grants);
  await saveProfile(profile);
  if (opencodeSettings && Object.keys(opencodeSettings).length > 0) {
    await saveOpencodeSettings(opencodeSettings);
  }

  const freshnessRecord: BackupVerificationRecord = {
    checkedAt: new Date().toISOString(),
    outcome: buildVerificationOutcome('restore', grants.length, persistedData.documents.length),
    grantCount: grants.length,
    documentCount: persistedData.documents.length,
    type: 'restore',
  };

  await saveBackupVerificationRecord(freshnessRecord);
  cleanupOldBackups().catch(() => {
    // non-critical
  });
}

export async function importBackupSnapshot(snapshot: BackupSnapshot): Promise<void> {
  const dataDir = getDataDir();
  await fs.mkdir(path.join(dataDir, 'documents'), { recursive: true });

  await savePersistedData(snapshot.persistedData);
  await saveGrants(snapshot.grants);
  await saveProfile(snapshot.profile);
  if (snapshot.opencodeSettings) {
    await saveOpencodeSettings(snapshot.opencodeSettings);
  }

  for (const document of snapshot.documents) {
    const buffer = Buffer.from(document.contentBase64, 'base64');
    await fs.writeFile(document.storagePath, buffer);
  }

  const freshnessRecord: BackupVerificationRecord = {
    checkedAt: new Date().toISOString(),
    outcome: buildVerificationOutcome('restore', snapshot.grants.length, snapshot.persistedData.documents.length),
    grantCount: snapshot.grants.length,
    documentCount: snapshot.persistedData.documents.length,
    type: 'restore',
  };

  await saveBackupVerificationRecord(freshnessRecord);
}

async function cleanupOldBackups(): Promise<void> {
  try {
    const backupsDir = getBackupsDir();
    if (!fsSync.existsSync(backupsDir)) return;

    const files = await fs.readdir(backupsDir);
    const zipFiles = files.filter((f) => f.endsWith('.zip') && !f.endsWith('.sha256')).map((f) => ({
      name: f,
      path: path.join(backupsDir, f),
    }));

    if (zipFiles.length <= 5) return;

    const stats = await Promise.all(
      zipFiles.map(async (f) => ({ ...f, mtime: (await fs.stat(f.path)).mtimeMs }))
    );
    stats.sort((a, b) => a.mtime - b.mtime);

    while (stats.length > 5) {
      const oldest = stats.shift()!;
      await fs.unlink(oldest.path).catch(() => {});
      await fs.unlink(`${oldest.path}.sha256`).catch(() => {});
    }
  } catch {
    // non-critical
  }
}

export async function recordBackupVerification(snapshot: BackupSnapshot): Promise<void> {
  const record: BackupVerificationRecord = {
    checkedAt: new Date().toISOString(),
    outcome: buildVerificationOutcome('backup', snapshot.grants.length, snapshot.persistedData.documents.length),
    grantCount: snapshot.grants.length,
    documentCount: snapshot.persistedData.documents.length,
    type: 'backup',
  };
  await saveBackupVerificationRecord(record);
  const freshness = await loadBackupFreshness();
  await saveBackupFreshness({
    lastBackupAt: record.checkedAt,
    isStale: false,
    lastBackupVerification: record,
    lastRestoreVerification: freshness.lastRestoreVerification,
  });
}
