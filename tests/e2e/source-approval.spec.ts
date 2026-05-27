import { expect, test } from '@playwright/test';
import { BASE_URL, resetAppState } from './test-utils';

test('source-approval-review: approve a pending source from the sources queue', async ({
  page,
  request,
}) => {
  await resetAppState(request);

  const createSourceResponse = await request.post(`${BASE_URL}/api/sources`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      name: 'AI Curated Foundation Feed',
      url: 'https://example.org/foundation-feed',
      type: 'website',
      reviewStatus: 'pending-review',
      suggestedBy: 'ai',
      suggestionReason: 'Suggested during prompt-driven discovery',
    },
  });
  expect(createSourceResponse.ok()).toBeTruthy();
  const createdSource = (await createSourceResponse.json()) as {
    source: { id: string; name: string };
  };

  await page.goto(BASE_URL);
  await page.waitForSelector('.app', { timeout: 60000 });

  await expect(
    page.locator('.nav-item[data-view="sources"] .nav-count'),
  ).toHaveText('1');

  await page.click('[data-view="sources"]');
  await expect(page.locator('#view-sources')).toHaveClass(/active/);
  const pendingReviewSection = page.locator(
    'section[data-testid="sources-pending-review-section"]',
  );
  await expect(pendingReviewSection).toContainText(createdSource.source.name);

  const approveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(
        `/api/sources/${createdSource.source.id}/review`,
      ) && response.request().method() === 'POST',
  );
  await page.getByTestId(`approve-source-btn-${createdSource.source.id}`).click();
  const approveResult = await approveResponse;
  expect(approveResult.ok()).toBeTruthy();

  await expect(pendingReviewSection).toContainText('No sources pending review');
  await expect(
    page.locator('.nav-item[data-view="sources"] .nav-count'),
  ).toHaveCount(0);

  const sourcesResponse = await request.get(`${BASE_URL}/api/sources`);
  expect(sourcesResponse.ok()).toBeTruthy();
  const sources = (await sourcesResponse.json()) as Array<{
    id: string;
    reviewStatus?: string;
    approvedAt?: string;
    isActive: boolean;
  }>;
  const approvedSource = sources.find(
    (source) => source.id === createdSource.source.id,
  );
  expect(approvedSource).toBeDefined();
  expect(approvedSource?.reviewStatus).toBe('approved');
  expect(approvedSource?.approvedAt).toBeTruthy();
  expect(approvedSource?.isActive).toBe(true);
});
