import { expect, test } from '@playwright/test';
import { BASE_URL, resetAppState } from './test-utils';

test.describe('pipeline-list-view', () => {
	test.beforeEach(async ({ request }) => {
		await resetAppState(request);
	});

	test('renders the pipeline list view with working filters', async ({ page }) => {
		await page.goto(BASE_URL);
		await page.waitForSelector('.app', { timeout: 60000 });

		await page.getByRole('button', { name: 'Pipeline' }).click();
		await page.getByTestId('pipeline-view-mode-toggle').click();

		await expect(page.getByTestId('pipeline-list-view')).toBeVisible();
		await expect(page.getByTestId('pipeline-responsibility-filter')).toBeVisible();
		await expect(page.getByTestId('pipeline-urgency-filter')).toBeVisible();
		await expect(page.getByTestId('pipeline-funder-type-filter')).toBeVisible();
	});
});
