import 'server-only';
/**
 * Cache Cleanup Service
 *
 * Implements tmp/cache cleanup policies:
 * - On startup: delete old tmp files
 * - Periodic cleanup every 6 hours
 * - Size-based cleanup for .cache directory (max 500MB)
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJobQueue, getSqliteState } from '../../../../shared/grant-ops-sqlite';
import { resolveDataDir } from '../../../../shared/grant-ops-sqlite';

const TMP_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ARTIFACT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_MAX_SIZE_MB = 500;
const CACHE_MAX_SIZE_BYTES = CACHE_MAX_SIZE_MB * 1024 * 1024;

interface CleanupStats {
  deletedFiles: number;
  freedBytes: number;
  errors: string[];
}

export function ensureTmpDirectories(dataDir: string): void {
  const dirs = [
    path.join(dataDir, 'tmp'),
    path.join(dataDir, 'tmp', '.cache'),
    path.join(dataDir, 'artifacts'),
    path.join(dataDir, 'artifacts', 'research'),
    path.join(dataDir, 'artifacts', 'drafts'),
    path.join(dataDir, 'artifacts', 'matches'),
    path.join(dataDir, 'artifacts', 'extracts'),
    path.join(dataDir, 'artifacts', 'crawls'),
    path.join(dataDir, 'artifacts', 'peer-discoverys'),
    path.join(dataDir, 'artifacts', 'funder-insightss'),
    path.join(dataDir, 'artifacts', 'eligibility-vettings'),
    path.join(dataDir, 'artifacts', 'budget-imports'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    fs.chmodSync(path.join(dataDir, 'tmp'), 0o700);
  } catch {
    // best effort
  }
}

function getActiveJobIds(): Set<string> {
  try {
    const dataDir = resolveDataDir();
    const state = getSqliteState(dataDir);
    const activeJobs = readJobQueue(state);
    const activeIds = activeJobs
      .filter((job) => job.status === 'running' || job.status === 'queued' || job.status === 'retrying' || job.status === 'verifying')
      .map((job) => job.id);
    return new Set(activeIds);
  } catch {
    return new Set();
  }
}

function isFileOpenForWriting(filePath: string): boolean {
  try {
    const activeJobIds = getActiveJobIds();
    const basename = path.basename(filePath);
    for (const jobId of activeJobIds) {
      if (basename.includes(jobId)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function deleteOldFiles(
  directory: string,
  maxAgeMs: number,
  pattern?: RegExp,
): CleanupStats {
  const stats: CleanupStats = { deletedFiles: 0, freedBytes: 0, errors: [] };

  try {
    if (!fs.existsSync(directory)) return stats;
    const entries = fs.readdirSync(directory);

    for (const entry of entries) {
      const fullPath = path.join(directory, entry);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) continue;

        if (isFileOpenForWriting(fullPath)) continue;

        if (pattern && !pattern.test(entry)) continue;

        const age = Date.now() - stat.mtimeMs;
        if (age > maxAgeMs) {
          fs.unlinkSync(fullPath);
          stats.deletedFiles++;
          stats.freedBytes += stat.size;
        }
      } catch (err) {
        stats.errors.push(`${entry}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    stats.errors.push(`Failed to read directory ${directory}: ${err instanceof Error ? err.message : String(err)}`);
  }

  return stats;
}

function enforceCacheSizeLimit(cacheDir: string, maxBytes: number): CleanupStats {
  const stats: CleanupStats = { deletedFiles: 0, freedBytes: 0, errors: [] };

  try {
    if (!fs.existsSync(cacheDir)) return stats;

    const entries = fs.readdirSync(cacheDir).map(name => {
      const fullPath = path.join(cacheDir, name);
      try {
        const stat = fs.statSync(fullPath);
        return { path: fullPath, mtime: stat.mtimeMs, size: stat.size };
      } catch {
        return null;
      }
    }).filter(Boolean) as { path: string; mtime: number; size: number }[];

    let totalSize = entries.reduce((sum, e) => sum + e.size, 0);

    if (totalSize <= maxBytes) return stats;

    entries.sort((a, b) => a.mtime - b.mtime);

    for (const entry of entries) {
      if (totalSize <= maxBytes) break;
      if (isFileOpenForWriting(entry.path)) continue;

      try {
        fs.unlinkSync(entry.path);
        totalSize -= entry.size;
        stats.deletedFiles++;
        stats.freedBytes += entry.size;
      } catch (err) {
        stats.errors.push(`${entry.path}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    stats.errors.push(`Cache size enforcement error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return stats;
}

export function cleanupTmpDir(dataDir: string): CleanupStats {
  const tmpDir = path.join(dataDir, 'tmp');
  const cacheDir = path.join(tmpDir, '.cache');

  const stats: CleanupStats = { deletedFiles: 0, freedBytes: 0, errors: [] };

  const jsonStats = deleteOldFiles(tmpDir, ARTIFACT_MAX_AGE_MS, /\.json$/);
  stats.deletedFiles += jsonStats.deletedFiles;
  stats.freedBytes += jsonStats.freedBytes;
  stats.errors.push(...jsonStats.errors);

  const logStats = deleteOldFiles(tmpDir, LOG_MAX_AGE_MS, /\.log$/);
  stats.deletedFiles += logStats.deletedFiles;
  stats.freedBytes += logStats.freedBytes;
  stats.errors.push(...logStats.errors);

  const cacheStats = deleteOldFiles(cacheDir, CACHE_MAX_AGE_MS);
  stats.deletedFiles += cacheStats.deletedFiles;
  stats.freedBytes += cacheStats.freedBytes;
  stats.errors.push(...cacheStats.errors);

  const sizeStats = enforceCacheSizeLimit(cacheDir, CACHE_MAX_SIZE_BYTES);
  stats.deletedFiles += sizeStats.deletedFiles;
  stats.freedBytes += sizeStats.freedBytes;
  stats.errors.push(...sizeStats.errors);

  return stats;
}

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startPeriodicCleanup(dataDir: string): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    cleanupTmpDir(dataDir);
  }, TMP_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();
}

export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}
