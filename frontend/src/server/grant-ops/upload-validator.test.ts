/**
 * Upload Validator Tests
 *
 * Tests for the document upload validation chain:
 * 1. File exists and is readable
 * 2. File size <= MAX_FILE_SIZE (50MB default)
 * 3. File extension in allowlist
 * 4. MIME type matches extension (server-side via file magic bytes)
 * 5. Atomic write
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateFileExists,
  validateFileSize,
  validateFileExtension,
  validateMimeType,
  detectMimeTypeByMagic,
  atomicWrite,
  computeSha256,
} from './upload-validator';

const TEST_DIR = path.join(process.cwd(), '.grant-ops-data-test-upload-validator');

function createTestFile(name: string, content: Buffer): string {
  const filePath = path.join(TEST_DIR, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

describe('validateFileExists', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns null for existing readable file', () => {
    const filePath = createTestFile('test.txt', Buffer.from('hello'));
    const result = validateFileExists(filePath);
    expect(result).toBeNull();
  });

  it('returns FILE_NOT_FOUND for missing file', () => {
    const result = validateFileExists(path.join(TEST_DIR, 'nonexistent.txt'));
    expect(result).not.toBeNull();
    expect(result?.code).toBe('FILE_NOT_FOUND');
  });
});

describe('validateFileSize', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns null for file within size limit', () => {
    const filePath = createTestFile('small.txt', Buffer.from('hello'));
    const result = validateFileSize(filePath);
    expect(result).toBeNull();
  });

  it('returns FILE_TOO_LARGE for oversized file', () => {
    const filePath = createTestFile('huge.bin', Buffer.alloc(100));
    const result = validateFileSize(filePath, 50); // 50 byte limit
    expect(result).not.toBeNull();
    expect(result?.code).toBe('FILE_TOO_LARGE');
  });

  it('returns FILE_UNSUPPORTED_TYPE for empty file', () => {
    const filePath = createTestFile('empty.txt', Buffer.from(''));
    const result = validateFileSize(filePath);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('FILE_UNSUPPORTED_TYPE');
  });

  it('respects custom max size', () => {
    const filePath = createTestFile('medium.bin', Buffer.alloc(200));
    expect(validateFileSize(filePath, 50)?.code).toBe('FILE_TOO_LARGE');
    expect(validateFileSize(filePath, 1000)).toBeNull();
  });
});

describe('validateFileExtension', () => {
  it('returns null for allowed extension', () => {
    const result = validateFileExtension('test.pdf');
    expect(result).toBeNull();
  });

  it('returns null for allowed extension .docx', () => {
    const result = validateFileExtension('test.docx');
    expect(result).toBeNull();
  });

  it('returns FILE_UNSUPPORTED_TYPE for blocked extension', () => {
    const result = validateFileExtension('test.exe');
    expect(result).not.toBeNull();
    expect(result?.code).toBe('FILE_UNSUPPORTED_TYPE');
  });

  it('returns FILE_UNSUPPORTED_TYPE for no extension', () => {
    const result = validateFileExtension('testfile');
    expect(result).not.toBeNull();
    expect(result?.code).toBe('FILE_UNSUPPORTED_TYPE');
  });

  it('is case insensitive', () => {
    expect(validateFileExtension('TEST.PDF')).toBeNull();
    expect(validateFileExtension('Test.Pdf')).toBeNull();
  });
});

describe('detectMimeTypeByMagic', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('detects PDF by magic bytes', async () => {
    const filePath = createTestFile('test.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]));
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBe('application/pdf');
  });

  it('detects PNG by magic bytes', async () => {
    // Minimal PNG: signature + IHDR chunk header
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from([0x00, 0x00, 0x00, 0x0D]), // IHDR length
      Buffer.from('IHDR'),
      Buffer.alloc(17, 0), // IHDR data + CRC placeholder
    ]);
    const filePath = createTestFile('test.png', png);
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBe('image/png');
  });

  it('detects JPEG by magic bytes', async () => {
    const filePath = createTestFile('test.jpg', Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46]));
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBe('image/jpeg');
  });

  it('detects text/plain for ASCII content', async () => {
    const filePath = createTestFile('test.txt', Buffer.from('Hello world'));
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBe('text/plain');
  });

  it('returns null for binary content with no match', async () => {
    const filePath = createTestFile('test.bin', Buffer.from([0x01, 0x02, 0x03, 0x04]));
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBeNull();
  });

  it('returns null for non-text binary content', async () => {
    const filePath = createTestFile('tiny.bin', Buffer.from([0x01, 0x02]));
    const result = await detectMimeTypeByMagic(filePath);
    expect(result).toBeNull();
  });
});

describe('validateMimeType', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns null when MIME matches extension (PDF)', async () => {
    const filePath = createTestFile('test.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31]));
    const result = await validateMimeType(filePath);
    expect(result).toBeNull();
  });

  it('returns null when MIME matches extension (PNG)', async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
      Buffer.from([0x00, 0x00, 0x00, 0x0D]),
      Buffer.from('IHDR'),
      Buffer.alloc(17, 0),
    ]);
    const filePath = createTestFile('test.png', png);
    const result = await validateMimeType(filePath);
    expect(result).toBeNull();
  });

  it('returns error when MIME does not match extension', async () => {
    const filePath = createTestFile('test.pdf', Buffer.from('Hello world'));
    const result = await validateMimeType(filePath);
    expect(result).not.toBeNull();
    expect(result?.code).toBe('UPLOAD_VALIDATION_FAILED');
  });

  it('accepts originalFilename parameter for extension lookup', async () => {
    const filePath = createTestFile('upload.tmp.upload', Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31]));
    const result = await validateMimeType(filePath, 'original.pdf');
    expect(result).toBeNull();
  });

  it('returns null for extensions without MIME mapping', async () => {
    const filePath = createTestFile('test.xxx', Buffer.from([0x01, 0x02]));
    const result = await validateMimeType(filePath);
    expect(result).toBeNull();
  });
});

describe('atomicWrite', () => {
  const destDir = path.join(TEST_DIR, 'dest');

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('writes file atomically to destination', async () => {
    const sourcePath = createTestFile('source.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46]));
    const { destPath, error } = await atomicWrite(sourcePath, destDir, 'target.pdf');

    expect(error).toBeUndefined();
    expect(destPath).toContain('target.pdf');
    expect(fs.existsSync(destPath)).toBe(true);
    const content = fs.readFileSync(destPath);
    expect(content[0]).toBe(0x25);
  });

  it('creates destination directory if not exists', async () => {
    const sourcePath = createTestFile('source2.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46]));
    const nestedDir = path.join(destDir, 'nested', 'deep');
    const { error } = await atomicWrite(sourcePath, nestedDir, 'target.pdf');

    expect(error).toBeUndefined();
    expect(fs.existsSync(path.join(nestedDir, 'target.pdf'))).toBe(true);
  });

  it('returns error when source does not exist', async () => {
    const { error } = await atomicWrite(path.join(TEST_DIR, 'missing.txt'), destDir, 'target.txt');
    expect(error).toBeDefined();
    expect(error?.code).toBe('STORAGE_UNAVAILABLE');
  });

  it('does not leave temp files behind on success', async () => {
    const sourcePath = createTestFile('source3.pdf', Buffer.from([0x25, 0x50, 0x44, 0x46]));
    const { error } = await atomicWrite(sourcePath, destDir, 'target3.pdf');

    expect(error).toBeUndefined();
    const dirContents = fs.readdirSync(destDir);
    const tmpFiles = dirContents.filter((f) => f.startsWith('.tmp-'));
    expect(tmpFiles).toHaveLength(0);
  });
});

describe('computeSha256', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns correct SHA-256 hex for a file', () => {
    const content = Buffer.from('hello world');
    const filePath = createTestFile('sha-test.txt', content);
    const hash = computeSha256(filePath);
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash).toHaveLength(64);
  });

  it('returns different hashes for different content', () => {
    const path1 = createTestFile('a.txt', Buffer.from('content-a'));
    const path2 = createTestFile('b.txt', Buffer.from('content-b'));
    expect(computeSha256(path1)).not.toBe(computeSha256(path2));
  });

  it('throws for missing file', () => {
    expect(() => computeSha256(path.join(TEST_DIR, 'nonexistent.txt'))).toThrow();
  });
});
