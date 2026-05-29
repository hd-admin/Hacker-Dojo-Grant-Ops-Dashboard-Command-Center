import { describe, expect, it } from 'vitest';
import { POST } from './route';

describe('/api/safety/lock route', () => {
  it('POST returns 200 with locked: true', async () => {
    const response = await POST();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, locked: true });
  });
});
