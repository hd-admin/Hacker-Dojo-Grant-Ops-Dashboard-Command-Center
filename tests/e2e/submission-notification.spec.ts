import fs from 'node:fs/promises';
import path from 'node:path';
import {
	type APIRequestContext,
	expect,
	type Page,
	test,
} from '@playwright/test';
import { configureOpencodeThroughSettingsView, resetAppState, saveProfileThroughSettingsView, uploadDocumentThroughSettingsView } from './test-utils';

const fixturePath = path.join(
	process.cwd(),
	'tests/fixtures/documents/hacker-dojo-program-summary.pdf',
);
const opencodeStubPath = path.join(process.cwd(), 'tests/e2e/opencode-stub.sh');

async function ensureOpencodeStub(): Promise<string> {
	const script = `#!/bin/sh
set -eu

all_args="$*"
json_output=0
case "$all_args" in
	*"Research grants for the following organization:"*|*"--output-format json"*|*"--format json"*)
		json_output=1
		;;
esac

if [ "$json_output" -eq 1 ]; then
	cat <<'EOF'
{"grants":[{"id":"stub-grant-001","title":"Education Technology Community Grant","funder":"Mock Foundation","funderShort":"Mock","award":"$50,000","awardSort":50000,"deadline":"2026-06-30","daysOut":30,"fit":82,"tags":["EdTech","Community"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"},{"id":"stub-grant-002","title":"Community Innovation Grant","funder":"Alliance for Learning","funderShort":"Alliance","award":"$75,000","awardSort":75000,"deadline":"2026-07-15","daysOut":45,"fit":76,"tags":["Community","Innovation"],"status":"matched","statusLabel":"Matched","matchedAt":"2026-05-24T00:00:00.000Z"}],"evidence":[{"id":"stub-evidence-001","grantId":"stub-grant-001","sourceId":"stub-source-001","sourceName":"Stub Source","evidenceType":"eligibility","content":"Community alignment evidence","capturedAt":"2026-05-24T00:00:00.000Z"}],"rationale":"E2E research stub response"}
EOF
else
	cat <<'EOF'
## Hacker Dojo Grant Proposal

Hacker Dojo expands access to technology education and community innovation in Silicon Valley.

This draft is grounded in the uploaded organization profile and includes the grounded sentence exactly once.
EOF
fi
`;
	await fs.writeFile(opencodeStubPath, script, 'utf8');
	await fs.chmod(opencodeStubPath, 0o755);
	return opencodeStubPath;
}


async function openMatchedGrantWithoutDraft(
	page: Page,
	request: APIRequestContext,
) {
	const grantsResponse = await request.get('http://localhost:3000/api/grants');
	expect(grantsResponse.ok()).toBeTruthy();
	const grants: Array<{
		id: string;
		title: string;
		fit: number;
		status: string;
		draftContent?: string;
		funder: string;
	}> = await grantsResponse.json();

	const targetGrant = grants.find(
		(grant) => grant.status === 'matched' && !grant.draftContent,
	);
	expect(targetGrant).toBeDefined();
	if (!targetGrant) {
		throw new Error('Expected a matched grant without draft content');
	}

	const sortedGrants = [...grants].sort((a, b) => b.fit - a.fit);
	const selectedIndex = sortedGrants.findIndex(
		(grant) => grant.id === targetGrant.id,
	);
	expect(selectedIndex).toBeGreaterThan(-1);

	await page.click('[data-view="discovery"]');
	await page.locator('.grants-row:not(.header)').nth(selectedIndex).click();
	await expect(page.locator('.drawer-title')).toHaveText(targetGrant.title);
	return targetGrant;
}

test.describe('Submission Notification', () => {
	test.beforeEach(async ({ page, request }) => {
		await resetAppState(request);
		await page.goto('http://localhost:3000');
		await page.waitForSelector('.app', { timeout: 20000 });
	});

	test('notify-email-is-configured: notifyEmail is set in profile', async ({
		page,
	}) => {
		await page.click('[data-view="settings"]');
		await page.waitForSelector('#view-settings.active', { timeout: 10000 });
		await expect(page.locator('.setting-card').filter({ hasText: 'Agent Behavior' })).toContainText('ed@hackerdojo.com');
	});

	test('approval-submission-artifacts: approve, submit, and surface follow-up artifacts', async ({
		page,
		request,
	}) => {
		const stubPath = await ensureOpencodeStub();
		await saveProfileThroughSettingsView(
			page,
			'Community innovation and education with maker pathways.',
		);
		await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
		await uploadDocumentThroughSettingsView(page, fixturePath);

		const targetGrant = await openMatchedGrantWithoutDraft(page, request);

		await expect(page.locator('button:has-text("Generate draft")')).toBeVisible();
		await page.getByRole('button', { name: 'Generate draft' }).click();
		await expect(page.locator('.draft-preview')).toContainText(
			'Hacker Dojo expands access to technology education and community innovation in Silicon Valley.',
		);
		await expect(page.locator('.ai-badge')).toContainText('Drafted by agent');

		await page.getByRole('button', { name: 'Approve & lock' }).click();
		await expect(page.locator('.drawer-actions')).toContainText('Submit');

		await page.locator('.drawer-actions').getByRole('button', { name: 'Submit' }).click();
		await page
			.locator('.drawer-section')
			.filter({ hasText: 'Submit grant' })
			.locator('select')
			.selectOption('email');
		await page
			.locator('input[placeholder="Confirmation ID"]')
			.fill(`PW-${Date.now()}`);
		await page
			.locator('textarea[placeholder="Submission notes"]')
			.fill('Submitted from the drawer workflow');
		await page
			.locator('.drawer-section')
			.filter({ hasText: 'Submit grant' })
			.getByRole('button', { name: 'Submit' })
			.click();

		const grantDetailResponse = await request.get(
			`http://localhost:3000/api/grants/${targetGrant.id}`,
		);
		expect(grantDetailResponse.ok()).toBeTruthy();
		const grantDetail = await grantDetailResponse.json();
		expect(grantDetail.grant.status).toBe('submitted');
		expect(grantDetail.submissionRecord?.grantId).toBe(targetGrant.id);
		expect(Array.isArray(grantDetail.followUps)).toBe(true);
		expect(grantDetail.followUps.length).toBeGreaterThan(0);

		const followUpsResponse = await request.get('http://localhost:3000/api/follow-ups');
		expect(followUpsResponse.ok()).toBeTruthy();
		const followUps = (await followUpsResponse.json()) as Array<{ grantId?: string; submissionId?: string; title: string }>;
		expect(followUps.some((followUp) => followUp.grantId === targetGrant.id)).toBe(true);

		const notificationsResponse = await request.get('http://localhost:3000/api/notifications');
		expect(notificationsResponse.ok()).toBeTruthy();
		const notifications = (await notificationsResponse.json()) as Array<{ text: string }>;
		expect(notifications.some((notification) => /Email submission sent to/i.test(notification.text))).toBe(true);

		const tasksResponse = await request.get('http://localhost:3000/api/tasks');
		expect(tasksResponse.ok()).toBeTruthy();
		const tasks = (await tasksResponse.json()) as Array<{ text: string; completed: boolean }>;
		expect(tasks.some((task) => /Follow up on email submission/i.test(task.text))).toBe(true);

		await page.click('[data-view="notifications"]');
		await expect(page.locator('body')).toContainText('Email submission sent to');

		await page.click('[data-view="tasks"]');
		await expect(page.locator('body')).toContainText('Follow up on email submission');
	});
});
