import { NextRequest, NextResponse } from 'next/server';
import { OrganizationProfileSchema } from '../../../../../shared/schemas';
import type { OrganizationProfile } from '../../../../../shared/types';
import * as profileService from '@/server/grant-ops/profile-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const profile = await profileService.getProfile();
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const missingFields = profileService.getMissingRequiredFields(profile);
    const readiness = await profileService.isSubmissionReady(profile);

    return NextResponse.json({
      ...profile,
      _meta: {
        missingRequiredFields: missingFields,
        submissionReady: readiness.ready,
        blockingReason: readiness.blockingReason,
      },
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    return NextResponse.json({ error: 'Failed to get profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid profile data', details: 'Request body must be a JSON object' },
        { status: 400 },
      );
    }

    // Validate body against schema
    const parsed = OrganizationProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid profile data',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await profileService.updateProfile(parsed.data as OrganizationProfile);

    // Fire-and-forget: rescore grants when searchThemes change
    if (Array.isArray(parsed.data.searchThemes)) {
      void (async () => {
        try {
          const { loadGrants, saveGrants } = await import('../../../../shared/grant-ops-persistence');
          const { scoreGrantByThemes } = await import('@/server/grant-ops/theme-service');
          const grants = await loadGrants();
          let changed = 0;
          const updated = await Promise.all(
            grants.map(async (grant) => {
              const newScore = await scoreGrantByThemes(grant.tags);
              if (newScore !== grant.fit) { changed++; return { ...grant, fit: newScore }; }
              return grant;
            }),
          );
          if (changed > 0) await saveGrants(updated);
        } catch (err) {
          console.error('[profile] Background rescore failed:', err);
        }
      })();
    }

    // Return updated profile with meta
    const updated = await profileService.getProfile();
    const missingFields = profileService.getMissingRequiredFields(updated);
    const readiness = await profileService.isSubmissionReady(updated);

    return NextResponse.json({
      ...updated,
      _meta: {
        missingRequiredFields: missingFields,
        submissionReady: readiness.ready,
        blockingReason: readiness.blockingReason,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
