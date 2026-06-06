import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from 'next/cache';
import { revalidateAfterMutation } from './revalidate';

describe('revalidateAfterMutation', () => {
  it('revalidates all mutation paths', () => {
    const mock = vi.mocked(revalidatePath);
    mock.mockClear();

    revalidateAfterMutation();

    expect(mock).toHaveBeenCalledWith('/');
    expect(mock).toHaveBeenCalledWith('/api/grants');
    expect(mock).toHaveBeenCalledWith('/api/funders');
    expect(mock).toHaveBeenCalledWith('/api/sources');
    expect(mock).toHaveBeenCalledWith('/api/jobs');
    expect(mock).toHaveBeenCalledTimes(5);
  });

  it('handles revalidatePath errors gracefully', () => {
    const mock = vi.mocked(revalidatePath);
    mock.mockImplementation(() => {
      throw new Error('Revalidation failed');
    });

    expect(() => revalidateAfterMutation()).not.toThrow();
  });
});
