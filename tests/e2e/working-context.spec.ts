import { expect, test } from '@playwright/test';
import { BASE_URL, resetAppState } from './test-utils';

test.describe('working-context', () => {
  test.beforeEach(async ({ request }) => {
    await resetAppState(request);
  });

  test('bootstrap: restores saved view, filters, and selected grant on launch', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.app', { timeout: 60000 });
    await page.evaluate(() => {
      window.localStorage.setItem(
        'grantops.workingContext',
        JSON.stringify({
          activeView: 'pipeline',
          selectedGrantId: 'dell-equality',
          recentGrantIds: ['dell-equality'],
          pipelineViewMode: 'list',
          pipelineStatusFilter: 'Drafting',
          pipelineResponsibilityFilter: 'finance',
          pipelineUrgencyFilter: 'soon',
          pipelineFunderTypeFilter: 'Foundation',
        }),
      );
    });
    await page.reload();
    await page.waitForSelector('.app', { timeout: 20000 });

    await expect(page.locator('#view-pipeline')).toHaveClass(/active/);
    await expect(page.getByTestId('pipeline-list-view')).toBeVisible();
    await expect(
      page.locator('#view-pipeline .header-actions select').first(),
    ).toHaveValue('Drafting');
    await expect(page.getByTestId('pipeline-responsibility-filter')).toHaveValue(
      'finance',
    );
    await expect(page.getByTestId('pipeline-urgency-filter')).toHaveValue('soon');
    await expect(page.getByTestId('pipeline-funder-type-filter')).toHaveValue(
      'Foundation',
    );
    await expect(page.locator('.drawer-title')).toHaveText(
      'Dell Technologies Equality Fund',
    );
  });

  test('persistence: writes discovery filters and selected grant into localStorage', async ({
    page,
  }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.app', { timeout: 20000 });

    await page.click('[data-view="discovery"]');
    await expect(page.locator('#view-discovery')).toHaveClass(/active/);
    await page
      .locator('input[placeholder="Search grants, funders, tags..."]')
      .fill('Dell');
    await page.locator('#view-discovery .filter-bar select').selectOption('deadline');
    await page
      .locator('#view-discovery .filter-pill', { hasText: 'Corporate' })
      .click();
    await expect(
      page.locator('#view-discovery .grants-row:not(.header)'),
    ).toHaveCount(1);
    await page
      .locator('.grants-row', { hasText: 'Dell Technologies Equality Fund' })
      .click();
    await expect(page.locator('.drawer-title')).toHaveText(
      'Dell Technologies Equality Fund',
    );

    const workingContext = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('grantops.workingContext') || '{}'),
    );
    expect(workingContext.activeView).toBe('discovery');
    expect(workingContext.selectedGrantId).toBe('dell-equality');
    expect(workingContext.recentGrantIds).toContain('dell-equality');
    expect(workingContext.discoverySearch).toBe('Dell');
    expect(workingContext.discoverySort).toBe('deadline');
    expect(workingContext.discoveryCategory).toBe('Corporate');
  });
});
