// @vitest-environment node
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../../shared/grant-ops-persistence';
import * as repository from '../../../server/grant-ops/repository';
import { GET, PATCH, POST } from './route';

const fixturePath = path.join(
  process.cwd(),
  'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);

function buildMultipartRequest(fields: Record<string, string>, file: { name: string; type: string; bytes: Buffer }) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  formData.append('file', new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
  return { formData };
}

describe('/api/documents route', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    await tempDataDir.cleanup();
    invalidateCache();
  });

  it('GET returns persisted documents', async () => {
    const response = await GET(
      new Request('http://localhost/api/documents') as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('POST uploads the pdf fixture and persists extraction fields', async () => {
    const bytes = await fs.readFile(fixturePath);
    const payload = await buildMultipartRequest(
      { name: 'Hacker Dojo Program Summary', type: 'PDF' },
      {
        name: 'hacker-dojo-program-summary.pdf',
        type: 'application/pdf',
        bytes,
      },
    );

    const response = await POST(
      { formData: async () => payload.formData } as never,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('Hacker Dojo Program Summary');
    expect(data.type).toBe('PDF');
    expect(data.uploadedAt).toBeDefined();
    expect(data.storagePath).toContain(path.join(tempDataDir.dataDir, 'documents'));
    expect(data.extractionStatus).toBe('extracted');
    expect(data.extractedText).toContain('Hacker Dojo Grant Program Summary');
    expect(data.extractedText).toContain(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );
    expect(data.contentSnippet).toBe(
      'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    );
    expect(await fs.stat(data.storagePath)).toBeTruthy();
  });

  it('returns stored_unparsed for accepted non-pdf uploads', async () => {
    const payload = await buildMultipartRequest(
      { name: 'Notes', type: 'DOCX' },
      {
        name: 'notes.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        bytes: Buffer.from([1, 2, 3]),
      },
    );

    const response = await POST(
      { formData: async () => payload.formData } as never,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.extractionStatus).toBe('stored_unparsed');
    expect(data.extractedText).toBeUndefined();
    expect(data.contentSnippet).toBeUndefined();
  });

  it('PATCH updates document metadata when id is provided', async () => {
    await repository.addDocument({
      id: 'doc-patch-1',
      name: 'Hacker Dojo Program Summary',
      type: 'PDF',
      version: '1.0',
      audited: false,
      uploadedAt: new Date().toISOString(),
      storagePath: path.join(tempDataDir.dataDir, 'documents', 'doc-patch-1-hacker-dojo-program-summary.pdf'),
      extractionStatus: 'extracted',
      extractedText: 'Hacker Dojo Grant Program Summary Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
      contentSnippet: 'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
    });

    const response = await PATCH(
      new Request('http://localhost/api/documents', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'doc-patch-1', audited: true, version: '2.0' }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('PATCH returns 400 when document id is missing', async () => {
    const response = await PATCH(
      new Request('http://localhost/api/documents', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audited: true }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Document ID is required/i);
  });
});
