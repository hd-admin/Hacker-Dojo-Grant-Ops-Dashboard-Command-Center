import { NextRequest, NextResponse } from 'next/server';
import { OrganizationProfileSchema } from '../../../../../shared/schemas';
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

    await profileService.updateProfile(parsed.data);

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
