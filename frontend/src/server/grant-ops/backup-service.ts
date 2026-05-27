import fs from 'node:fs/promises';
import path from 'node:path';
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

export async function recordBackupVerification(snapshot: BackupSnapshot): Promise<void> {
  const record: BackupVerificationRecord = {
    checkedAt: new Date().toISOString(),
    outcome: buildVerificationOutcome('backup', snapshot.grants.length, snapshot.persistedData.documents.length),
    grantCount: snapshot.grants.length,
    documentCount: snapshot.persistedData.documents.length,
    type: 'backup',
  };
  const current = await loadBackupFreshness();
  await saveBackupVerificationRecord(record);
  await saveBackupFreshness({
    lastBackupAt: record.checkedAt,
    isStale: false,
    lastBackupVerification: record,
    lastRestoreVerification: current.lastRestoreVerification,
  });
}
