import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
	configureOpencodeThroughSettingsView,
	resetAppState,
	uploadDocumentThroughSettingsView,
} from './test-utils';

const fixturePath = path.join(
	process.cwd(),
	'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);

test('health-bootstrap: app launches and health endpoint reports operational status', async ({
	page,
	request,
}) => {
	const stubPath = path.join(process.cwd(), '.agent/tmp/health-opencode-stub.sh');
	await fs.mkdir(path.dirname(stubPath), { recursive: true });
	await fs.writeFile(
		stubPath,
		`#!/bin/sh
set -eu
case "$*" in
	*"--version"*)
		echo 0.1.5
		;;
	*)
		echo ok
		;;
esac
`,
		'utf8',
	);
	await fs.chmod(stubPath, 0o755);

	try {
		await resetAppState(request);
		await page.goto('http://localhost:3000');
		await page.waitForSelector('.app', { timeout: 20000 });

		await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
		await uploadDocumentThroughSettingsView(page, fixturePath);

		const healthResponse = await request.get('http://localhost:3000/api/health');
		expect(healthResponse.ok()).toBeTruthy();
		const health = (await healthResponse.json()) as {
			storage: string;
			opencode: string;
			opencodeVersion?: string;
			crawlerStatus: string;
			documentIndexer: string;
		};

		expect(health.storage).toBe('ok');
		expect(health.opencode).toBe('ok');
		expect(health.opencodeVersion).toBe('0.1.5');
		expect(health.crawlerStatus).toBe('never-run');
		expect(health.documentIndexer).toBe('ok');
	} finally {
		await fs.rm(stubPath, { force: true });
	}
});
