import { expect, test } from '@playwright/test';
import { BASE_URL, markScheduleDue, resetAppState } from './test-utils';

test('scheduled-crawl: due schedules trigger a real crawl run', async ({
  request,
}) => {
  await resetAppState(request);

  const createSourceResponse = await request.post(`${BASE_URL}/api/sources`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      name: 'Scheduled Research Source',
      url: 'https://example.org/scheduled-source',
      type: 'website',
    },
  });
  expect(createSourceResponse.ok()).toBeTruthy();
  const createdSource = (await createSourceResponse.json()) as {
    source: { id: string };
  };

  const saveScheduleResponse = await request.put(
    `${BASE_URL}/api/sources/${createdSource.source.id}/schedule`,
    {
      headers: { 'Content-Type': 'application/json' },
      data: { intervalHours: 1, isEnabled: true },
    },
  );
  expect(saveScheduleResponse.ok()).toBeTruthy();
  const savedSchedule = (await saveScheduleResponse.json()) as { id: string };

  await markScheduleDue(request, createdSource.source.id);

  const triggerResponse = await request.post(
    `${BASE_URL}/api/crawl/scheduled`,
  );
  expect(triggerResponse.ok()).toBeTruthy();
  const triggerResult = (await triggerResponse.json()) as { triggered: number };
  expect(triggerResult.triggered).toBe(1);

  const researchResponse = await request.get(`${BASE_URL}/api/research`);
  expect(researchResponse.ok()).toBeTruthy();
  const research = (await researchResponse.json()) as {
    latestRun: {
      status: string;
      sourcesCrawled: number;
      grantsMatched: number;
    } | null;
  };
  expect(research.latestRun).not.toBeNull();
  expect(research.latestRun?.status).toBe('completed');
  expect(research.latestRun?.sourcesCrawled).toBeGreaterThan(0);
  expect(research.latestRun?.grantsMatched).toBeGreaterThanOrEqual(0);

  const scheduleResponse = await request.get(
    `${BASE_URL}/api/sources/${createdSource.source.id}/schedule`,
  );
  expect(scheduleResponse.ok()).toBeTruthy();
  const refreshedSchedule = (await scheduleResponse.json()) as {
    nextScheduledAt: string;
  };
  expect(new Date(refreshedSchedule.nextScheduledAt).getTime()).toBeGreaterThan(
    Date.now(),
  );

  const sourcesResponse = await request.get(`${BASE_URL}/api/sources`);
  expect(sourcesResponse.ok()).toBeTruthy();
  const sources = (await sourcesResponse.json()) as Array<{
    id: string;
    lastCrawledAt?: string;
  }>;
  const scheduledSource = sources.find(
    (source) => source.id === createdSource.source.id,
  );
  expect(scheduledSource?.lastCrawledAt).toBeTruthy();
});
