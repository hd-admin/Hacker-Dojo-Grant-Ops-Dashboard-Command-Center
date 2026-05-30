import { NextResponse } from 'next/server';
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

// PUT handler removed — profile is hardcoded via HARDCODED_PROFILE and is read-only.
