/**
 * Grants API Route Tests
 *
 * Tests the /api/grants endpoint for listing grants.
 * These tests exercise the actual route handler to verify the route contract
 * and assert the exact required ID order for fit, deadline with Rolling last, and award.
 */

import type { NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the entire dependencies module before importing the route
vi.mock('@/server/grant-ops/dependencies', () => ({
  getDependencies: vi.fn(),
  setDependencies: vi.fn(),
  resetDependencies: vi.fn(),
  createDependencies: vi.fn(),
  systemClock: { now: () => new Date() },
  cryptoIdGenerator: { generateId: (prefix: string) => `${prefix}-test` },
  cwdPersistenceRoot: { getBaseDir: () => '/tmp/test' },
}));

import { getDependencies } from '@/server/grant-ops/dependencies';
import { invalidateCache } from '../../../../../shared/grant-ops-persistence';
// Import route after mocking
import { GET } from './route';

// Mock NextRequest
vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    connection: async () => {},
    NextRequest: class MockNextRequest {
      url: string;
      constructor(url: string | URL) {
        this.url = url.toString();
      }
    },
  };
});

describe('Grants API Route', () => {
  // Mock grants in UNSORTED order to verify route sorting
  // This ensures the route is actually sorting, not just returning mock data in order
  const mockGrants = [
    {
      id: 'dell-equality',
      title: 'Dell Equality Initiative',
      funder: 'Dell Technologies',
      funderShort: 'Dell',
      award: '$150,000',
      awardSort: 150000,
      deadline: '2026-07-15',
      daysOut: 54,
      fit: 76,
      tags: ['Equality'],
      status: 'matched',
      statusLabel: 'Matched',
      matchedAt: '2026-05-01',
    },
    {
      id: 'google-cs',
      title: 'Google CS Research',
      funder: 'Google',
      funderShort: 'Google',
      award: '$100,000',
      awardSort: 100000,
      deadline: '2026-06-01',
      daysOut: 10,
      fit: 79,
      tags: ['CS', 'Research'],
      status: 'matched',
      statusLabel: 'Matched',
      matchedAt: '2026-05-01',
    },
    {
      id: 'svcf-community',
      title: 'SVCF Community Grants',
      funder: 'Silicon Valley Community Foundation',
      funderShort: 'SVCF',
      award: '$75,000',
      awardSort: 75000,
      deadline: 'Rolling',
      daysOut: 999,
      fit: 82,
      tags: ['Community'],
      status: 'matched',
      statusLabel: 'Matched',
      matchedAt: '2026-05-01',
    },
    {
      id: 'nsf-tech',
      title: 'NSF Technology Innovation',
      funder: 'National Science Foundation',
      funderShort: 'NSF',
      award: '$350,000',
      awardSort: 350000,
      deadline: '2026-06-15',
      daysOut: 24,
      fit: 88,
      tags: ['Technology', 'Innovation'],
      status: 'matched',
      statusLabel: 'Matched',
      matchedAt: '2026-05-01',
    },
  ];

  beforeEach(() => {
    invalidateCache();
    vi.clearAllMocks();

    // Setup mock dependencies
    const mockRepo = {
      getGrants: vi.fn().mockResolvedValue(mockGrants),
      getGrant: vi.fn(),
      addGrant: vi.fn(),
      updateGrant: vi.fn(),
      deleteGrant: vi.fn(),
      getDraftArtifacts: vi.fn(),
      addDraftArtifact: vi.fn(),
      getRevisionRequests: vi.fn(),
      addRevisionRequest: vi.fn(),
      getApprovalRecord: vi.fn(),
      addApprovalRecord: vi.fn(),
      getSubmissionRecord: vi.fn(),
      addSubmissionRecord: vi.fn(),
      getFollowUps: vi.fn(),
      addFollowUp: vi.fn(),
    };

    (getDependencies as ReturnType<typeof vi.fn>).mockReturnValue({
      repository: mockRepo,
      sourceService: {
        getAllSources: vi.fn(),
        getSource: vi.fn(),
        addSource: vi.fn(),
        updateSource: vi.fn(),
        deleteSource: vi.fn(),
      },
      createOpencodeAdapter: vi.fn(),
      clock: { now: () => new Date() },
      idGenerator: {
        generateId: (prefix: string) => `${prefix}-${Date.now()}-test`,
      },
      persistenceRoot: { getBaseDir: () => '/tmp/test' },
    });
  });

  afterEach(() => {
    invalidateCache();
    vi.restoreAllMocks();
  });

  describe('GET /api/grants', () => {
    it('returns grants through the route handler with pagination shape', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(getDependencies).toHaveBeenCalled();

      expect(data).toBeDefined();
      expect(data).toHaveProperty('items');
      expect(data).toHaveProperty('page');
      expect(data).toHaveProperty('pageSize');
      expect(data).toHaveProperty('total');
      expect(data.page).toBe(1);
      expect(data.pageSize).toBe(25);
      expect(data.total).toBe(4);
      expect(data.items.length).toBe(4);
    });

    it('returns grants with required fields from route', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?sortBy=fit');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data).toBeDefined();
      expect(data.items.length).toBe(4);

      for (const grant of data.items) {
        expect(grant).toHaveProperty('id');
        expect(grant).toHaveProperty('title');
        expect(grant).toHaveProperty('funder');
        expect(grant).toHaveProperty('award');
        expect(grant).toHaveProperty('awardSort');
        expect(grant).toHaveProperty('deadline');
        expect(grant).toHaveProperty('daysOut');
        expect(grant).toHaveProperty('fit');
        expect(grant).toHaveProperty('status');
      }
    });

    it('returns grants sorted by fit descending (default)', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?sortBy=fit');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      const expectedOrder = ['nsf-tech', 'svcf-community', 'google-cs', 'dell-equality'];
      const actualOrder = data.items.map((g: { id: string }) => g.id);
      expect(actualOrder).toEqual(expectedOrder);

      const fitScores = data.items.map((g: { fit: number }) => g.fit);
      expect(fitScores).toEqual([88, 82, 79, 76]);
    });

    it('returns grants sorted by deadline soonest with Rolling last', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?sortBy=deadline');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      const expectedOrder = ['google-cs', 'nsf-tech', 'dell-equality', 'svcf-community'];
      const actualOrder = data.items.map((g: { id: string }) => g.id);
      expect(actualOrder).toEqual(expectedOrder);

      const rollingIndex = actualOrder.indexOf('svcf-community');
      expect(rollingIndex).toBe(actualOrder.length - 1);
    });

    it('returns grants sorted by award descending', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?sortBy=award');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      const expectedOrder = ['nsf-tech', 'dell-equality', 'google-cs', 'svcf-community'];
      const actualOrder = data.items.map((g: { id: string }) => g.id);
      expect(actualOrder).toEqual(expectedOrder);

      const awardAmounts = data.items.map((g: { awardSort: number }) => g.awardSort);
      expect(awardAmounts).toEqual([350000, 150000, 100000, 75000]);
    });

    it('enforces default pageSize=25', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data.pageSize).toBe(25);
    });

    it('respects custom pageSize parameter', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?pageSize=2');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data.pageSize).toBe(2);
      expect(data.page).toBe(1);
      expect(data.total).toBe(4);
      expect(data.items.length).toBe(2);
    });

    it('paginates with page and pageSize', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?page=2&pageSize=2');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data.page).toBe(2);
      expect(data.pageSize).toBe(2);
      expect(data.total).toBe(4);
      expect(data.items.length).toBe(2);

      const firstPageRequest = new NextRequest(
        'http://localhost:3000/api/grants?page=1&pageSize=2',
      );
      const firstResponse = await GET(firstPageRequest);
      const firstData = await (firstResponse as NextResponse).json();

      const firstPageIds = firstData.items.map((g: { id: string }) => g.id);
      const secondPageIds = data.items.map((g: { id: string }) => g.id);
      expect(firstPageIds).not.toEqual(secondPageIds);
    });

    it('returns empty items when page exceeds data range', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?page=3&pageSize=10');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data.page).toBe(3);
      expect(data.total).toBe(4);
      expect(data.items.length).toBe(0);
    });

    it('returns 400 for pageSize exceeding max 100', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?pageSize=101');

      const response = await GET(mockRequest);
      expect(response.status).toBe(400);

      const data = await (response as NextResponse).json();
      expect(data.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid page value', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?page=0');

      const response = await GET(mockRequest);
      expect(response.status).toBe(400);
    });

    it('returns correct total count with pagination', async () => {
      const { NextRequest } = require('next/server');
      const mockRequest = new NextRequest('http://localhost:3000/api/grants?pageSize=1');

      const response = await GET(mockRequest);
      const data = await (response as NextResponse).json();

      expect(data.total).toBe(4);
      expect(data.items.length).toBe(1);
    });
  });
});
