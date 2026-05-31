import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import * as profileService from '@/server/grant-ops/profile-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  await connection();
  try {
    const profile = await profileService.getProfile();
    if (!profile) {
      return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', 'Profile not found'), { status: 404 });
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
    logger.error({ err: error }, 'Error getting profile');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get profile'), { status: 500 });
  }
}

// PUT handler removed — profile is hardcoded via HARDCODED_PROFILE and is read-only.
