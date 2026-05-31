import { NextResponse, connection } from "next/server";
import { createErrorResponse } from '@/lib/api-error-handler';
import { logger } from '@/lib/logger';
import { getDependencies } from "@/server/grant-ops/dependencies";
import { getHealth } from "@/server/grant-ops/health-service";

export const dynamic = "force-dynamic";

export async function GET() {
  await connection();
  try {
    const deps = getDependencies();
    const health = await getHealth(deps);
    const [events, jobs] = await Promise.all([
      deps.repository.getAuditEvents(20),
      deps.repository.getJobQueue(),
    ]);

    const recentErrors = events.filter((event) => /failed|error|rejected/i.test(event.eventType)).slice(0, 20);
    const activeJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
    const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 10);

    return NextResponse.json({
      health,
      recentErrors,
      activeJobs,
      failedJobs,
      systemInfo: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, 'Error getting diagnostics');
    return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', 'Failed to get diagnostics'), { status: 500 });
  }
}
