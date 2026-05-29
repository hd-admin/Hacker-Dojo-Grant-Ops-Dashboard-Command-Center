import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { createDependencies, resetDependencies, setDependencies } from '@/server/grant-ops/dependencies';
import { invalidateCache, withTempDataDir } from '../../../../../../shared/grant-ops-persistence';
import * as repository from '@/server/grant-ops/repository';
import type { Grant } from '../../../../../../shared/types';
import { GET } from './route';

function createGrant(overrides: Partial<Grant> & Pick<Grant, 'id' | 'title' | 'funder' | 'award' | 'awardSort' | 'deadline' | 'daysOut' | 'fit' | 'tags' | 'status' | 'statusLabel'>): Grant {
	return {
		funderShort: overrides.funder.slice(0, 12),
		matchedAt: '2026-01-01',
		...overrides,
	};
}

describe('/api/grants/export route', () => {
	let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

	beforeEach(async () => {
		tempDataDir = await withTempDataDir();
		invalidateCache();
		setDependencies(createDependencies());
	});

	afterEach(async () => {
		resetDependencies();
		await tempDataDir.cleanup();
		invalidateCache();
	});

	it('exports discovery grants as CSV by default', async () => {
		await repository.addGrant(
			createGrant({
				id: 'grant-1',
				title: 'Grant "Alpha"',
				funder: 'Funding, Inc.',
				award: '$50,000',
				awardSort: 50000,
				deadline: '2026-12-31',
				daysOut: 200,
				fit: 81,
				tags: ['Education', 'Community'],
				status: 'matched',
				statusLabel: 'Matched',
			}),
		);
		await repository.addGrant(
			createGrant({
				id: 'grant-2',
				title: 'Beta Grant',
				funder: 'Another Funder',
				award: '$25,000',
				awardSort: 25000,
				deadline: '2026-11-30',
				daysOut: 160,
				fit: 70,
				tags: ['Operations'],
				status: 'review',
				statusLabel: 'Review',
			}),
		);

		const response = await GET(new NextRequest('http://localhost:3000/api/grants/export'));
		const csv = await response.text();
		const [headerLine, firstRow, secondRow] = csv.split('\n');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-type')).toBe('text/csv');
		expect(response.headers.get('content-disposition')).toContain('grant-ops-export-');
		expect(headerLine).toBe('Title,Funder,Award,Deadline,Confidence,Days Out,Fit Score,Status,Tags,Funder Short');
		expect(firstRow).toContain('"Grant ""Alpha"""');
		expect(firstRow).toContain('"Funding, Inc."');
		expect(firstRow).toContain('"Education; Community"');
		expect(secondRow).toContain('"Beta Grant"');
		expect(csv).toContain('"Matched"');
	});

	it('exports pipeline grants and applies the status filter', async () => {
		await repository.addGrant(
			createGrant({
				id: 'grant-1',
				title: 'Pipeline One',
				funder: 'Pipeline Funder',
				award: '$100,000',
				awardSort: 100000,
				deadline: '2026-09-01',
				daysOut: 90,
				fit: 92,
				tags: ['Pipeline'],
				status: 'matched',
				statusLabel: 'Matched',
				responsibilityTag: 'review',
			}),
		);
		await repository.addGrant(
			createGrant({
				id: 'grant-2',
				title: 'Pipeline Two',
				funder: 'Other Funder',
				award: '$10,000',
				awardSort: 10000,
				deadline: '2026-08-01',
				daysOut: 60,
				fit: 60,
				tags: ['Skip'],
				status: 'submitted',
				statusLabel: 'Submitted',
				responsibilityTag: 'follow-up',
			}),
		);

		const response = await GET(
			new NextRequest('http://localhost:3000/api/grants/export?view=pipeline&status=matched'),
		);
		const csv = await response.text();
		const [headerLine, firstRow, secondRow] = csv.split('\n');

		expect(response.status).toBe(200);
		expect(response.headers.get('content-disposition')).toContain('grant-ops-pipeline-');
		expect(headerLine).toBe('Title,Funder,Award,Deadline,Status,Responsibility,Fit Score');
		expect(firstRow).toContain('"Pipeline One"');
		expect(firstRow).toContain('"review"');
		expect(secondRow).toBeUndefined();
		expect(csv).not.toContain('Pipeline Two');
	});
});
