import { revalidatePath } from 'next/cache';

const MUTATION_PATHS = ['/', '/api/grants', '/api/funders', '/api/sources', '/api/jobs'];

export function revalidateAfterMutation(): void {
  for (const p of MUTATION_PATHS) {
    try {
      revalidatePath(p);
    } catch {
      // best-effort revalidation
    }
  }
}
