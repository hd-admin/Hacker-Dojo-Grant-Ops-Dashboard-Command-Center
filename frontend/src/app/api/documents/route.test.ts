import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
  systemClock: { now: () => new Date('2026-05-22T12:00:00.000Z') },
  cryptoIdGenerator: { generateId: (prefix: string) => `${prefix}-test-id` },
  cwdPersistenceRoot: { getBaseDir: () => '/tmp/test' },
}));

import { getDependencies } from '@/server/grant-ops/dependencies';
import { GET, PATCH, POST } from './route';

const mockedGetDependencies = vi.mocked(getDependencies);

const getDocumentsMock = vi.fn();
const addDocumentMock = vi.fn();
const updateDocumentMock = vi.fn();

const mockDeps = {
  repository: {
    getDocuments: getDocumentsMock,
    addDocument: addDocumentMock,
    updateDocument: updateDocumentMock,
  },
  sourceService: {
    getActiveSources: vi.fn(),
    addSource: vi.fn(),
    updateSourceLastCrawled: vi.fn(),
  },
  createOpencodeAdapter: vi.fn(),
  clock: { now: () => new Date('2026-05-22T12:00:00.000Z') },
  idGenerator: { generateId: (prefix: string) => `${prefix}-test-id` },
  persistenceRoot: { getBaseDir: () => '/tmp/test' },
} as unknown as ReturnType<typeof getDependencies>;

describe('/api/documents route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDependencies.mockReturnValue(mockDeps);
  });

  it('GET returns persisted documents', async () => {
    getDocumentsMock.mockResolvedValue([
      { id: 'doc-1', name: 'Budget.pdf', type: 'PDF', lastUsed: '2026-05-01T00:00:00.000Z', version: '1.0', audited: true },
    ]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe('Budget.pdf');
  });

  it('POST creates a new document record with generated id and timestamp', async () => {
    const request = new Request('http://localhost/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'BoardRoster.docx', type: 'DOCX' }),
    });

    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('doc-test-id');
    expect(data.lastUsed).toBe('2026-05-22T12:00:00.000Z');
    expect(data.audited).toBe(false);
    expect(addDocumentMock).toHaveBeenCalledWith({
      id: 'doc-test-id',
      name: 'BoardRoster.docx',
      type: 'DOCX',
      lastUsed: '2026-05-22T12:00:00.000Z',
      version: undefined,
      audited: false,
    });
  });

  it('PATCH updates document metadata when id is provided', async () => {
    const request = new Request('http://localhost/api/documents', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'doc-1', audited: true, version: '2.0' }),
    });

    const response = await PATCH(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(updateDocumentMock).toHaveBeenCalledWith('doc-1', {
      version: '2.0',
      audited: true,
    });
  });

  it('PATCH returns 400 when document id is missing', async () => {
    const request = new Request('http://localhost/api/documents', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audited: true }),
    });

    const response = await PATCH(request as never);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toMatch(/Document ID is required/i);
    expect(updateDocumentMock).not.toHaveBeenCalled();
  });
});
