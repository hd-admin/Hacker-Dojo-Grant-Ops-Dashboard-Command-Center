import 'server-only';
/**
 * Upload Validator
 *
 * Implements the document upload validation chain:
 * 1. File exists and is readable
 * 2. File size <= MAX_FILE_SIZE (50MB default)
 * 3. File extension in allowlist
 * 4. MIME type matches extension (server-side via file magic bytes)
 * 5. Atomic write: temp path first, rename after DB record creation
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ApiErrorResponse } from '../../lib/api-error-handler';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.xlsx', '.xls',
  '.csv', '.txt', '.png', '.jpg', '.jpeg',
]);

const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.csv': ['text/csv', 'text/plain'],
  '.txt': ['text/plain'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
};

export interface ValidationResult {
  valid: boolean;
  error?: ApiErrorResponse | undefined;
  detectedMimeType?: string | undefined;
}

export function validateFileExists(filePath: string): ApiErrorResponse | null {
  try {
    if (!fs.existsSync(filePath)) {
      return { error: `File not found: ${filePath}`, code: 'FILE_NOT_FOUND' };
    }
    fs.accessSync(filePath, fs.constants.R_OK);
    return null;
  } catch {
    return { error: `Cannot read file: ${filePath}`, code: 'FILE_NOT_FOUND' };
  }
}

export function validateFileSize(filePath: string, maxSize: number = MAX_FILE_SIZE): ApiErrorResponse | null {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { error: 'File is empty', code: 'FILE_UNSUPPORTED_TYPE' };
    }
    if (stats.size > maxSize) {
      return { error: `File too large: ${(stats.size / 1024 / 1024).toFixed(1)}MB (max ${maxSize / 1024 / 1024}MB)`, code: 'FILE_TOO_LARGE' };
    }
    return null;
  } catch {
    return { error: 'Cannot determine file size', code: 'FILE_NOT_FOUND' };
  }
}

export function validateFileExtension(filePath: string): ApiErrorResponse | null {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      error: `Unsupported file type: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}`,
      code: 'FILE_UNSUPPORTED_TYPE',
    };
  }
  return null;
}

export async function detectMimeTypeByMagic(filePath: string): Promise<string | null> {
  try {
    const fileTypeModule = await import('file-type');
    const result = await (fileTypeModule as unknown as { fileTypeFromFile: (path: string) => Promise<{ mime: string } | undefined> }).fileTypeFromFile(filePath);
    if (result) {
      return result.mime;
    }

    // Fallback: check if it's plain text
    const buffer = Buffer.alloc(256);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 256, 0);
    fs.closeSync(fd);

    const firstBytes = Array.from(buffer.slice(0, bytesRead));
    if (firstBytes.every(b => b >= 0x20 && b <= 0x7E || b === 0x0A || b === 0x0D || b === 0x09)) {
      return 'text/plain';
    }

    return null;
  } catch {
    return null;
  }
}

export async function validateMimeType(filePath: string, originalFilename?: string): Promise<ApiErrorResponse | null> {
  const ext = path.extname(originalFilename ?? filePath).toLowerCase();
  const expectedMimes = EXTENSION_MIME_MAP[ext];
  if (!expectedMimes) return null;

  const detectedMime = await detectMimeTypeByMagic(filePath);
  if (!detectedMime) {
    return { error: 'Cannot detect file type. File may be corrupted.', code: 'FILE_UNSUPPORTED_TYPE' };
  }

  const isMatch = expectedMimes.some(expected => {
    if (expected === detectedMime) return true;
    if (expected.startsWith('application/vnd.openxmlformats') && detectedMime.startsWith('application/vnd.openxmlformats')) return true;
    if (expected === 'application/msword' && detectedMime === 'application/msword') return true;
    return false;
  });

  if (!isMatch) {
    return {
      error: `File content (${detectedMime}) doesn't match extension ${ext}`,
      code: 'UPLOAD_VALIDATION_FAILED',
    };
  }

  return null;
}

/**
 * Compute SHA-256 hash of a file for integrity verification.
 */
export function computeSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function validateUpload(filePath: string): Promise<ValidationResult> {
  const checks = [
    () => validateFileExists(filePath),
    () => validateFileSize(filePath),
    () => validateFileExtension(filePath),
    async () => await validateMimeType(filePath),
  ];

  for (const check of checks) {
    const error = await check();
    if (error) {
      return { valid: false, error };
    }
  }

  const detectedMimeType = await detectMimeTypeByMagic(filePath);
  return { valid: true, detectedMimeType: detectedMimeType ?? undefined };
}

export async function atomicWrite(
  sourcePath: string,
  destDir: string,
  destFilename: string,
): Promise<{ destPath: string; error?: ApiErrorResponse }> {
  const tmpPath = path.join(destDir, `.tmp-${crypto.randomUUID()}`);
  const destPath = path.join(destDir, destFilename);

  try {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(sourcePath, tmpPath);
    fs.renameSync(tmpPath, destPath);
    return { destPath };
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* cleanup attempt */ }
    return {
      destPath: '',
      error: {
        error: `Failed to write file: ${err instanceof Error ? err.message : String(err)}`,
        code: 'STORAGE_UNAVAILABLE',
      },
    };
  }
}

export { MAX_FILE_SIZE, ALLOWED_EXTENSIONS };
