import type { APIRequestContext } from '@playwright/test';

export async function resetAppState(request: APIRequestContext): Promise<void> {
  const response = await request.post('http://localhost:3000/api/testing/reset');
  if (!response.ok()) {
    throw new Error(`Failed to reset app state: ${response.status()}`);
  }
}
