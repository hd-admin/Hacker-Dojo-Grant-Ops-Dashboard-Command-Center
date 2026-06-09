import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  BASE_URL,
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
    await page.goto(BASE_URL);
    await page.waitForSelector('.app', { timeout: 60000 });

    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
    await uploadDocumentThroughSettingsView(page, fixturePath);

    const healthResponse = await request.get(`/api/health`);
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
    expect(typeof health.opencodeVersion).toBe('string');
    expect(health.opencodeVersion).toBeTruthy();
    expect(health.crawlerStatus).toBe('never-run');
    expect(health.documentIndexer).toBe('ok');
  } finally {
    await fs.rm(stubPath, { force: true });
  }
});
