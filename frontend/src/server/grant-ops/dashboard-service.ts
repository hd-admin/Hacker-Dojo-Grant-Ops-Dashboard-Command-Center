/**
 * Dashboard Service - KPIs, Reporting, and Export
 *
 * Provides dashboard-level computations including:
 * - Total pipeline value
 * - Draft-ready count
 * - Review queue
 * - Recent matches
 * - Upcoming deadlines (30 days, split by confidence)
 * - Crawl health summary
 * - Historical reporting: active/submitted/awarded/declined/archived
 * - CSV export for discovery and pipeline
 */

import type { CrawlRun, Grant } from "../../../../shared/types";
import { getCrawlRuns, getGrants } from "./repository";

export interface DashboardKpis {
  totalPipelineValue: number;
  activeGrantCount: number;
  draftReadyCount: number;
  reviewQueueCount: number;
  upcomingDeadlines: UpcomingDeadline[];
  recentMatches: Grant[];
  crawlHealth: CrawlHealthSummary;
  historical: HistoricalCounts;
  periodStats: PeriodStats;
}

export interface UpcomingDeadline {
  grant: Grant;
  daysOut: number;
  confidence: Grant["deadlineConfidence"];
}

export interface CrawlHealthSummary {
  lastSuccessfulRun: CrawlRun | null;
  consecutiveFailures: number;
  isStale: boolean;
  staleDays: number | null;
}

export interface HistoricalCounts {
  active: number;
  submitted: number;
  awarded: number;
  declined: number;
  archived: number;
}

export interface PeriodStats {
  matchedThisMonth: number;
  submittedThisMonth: number;
  awardedThisMonth: number;
}

export interface CsvExport {
  headers: string[];
  rows: string[][];
  filename: string;
}

/**
 * Get all dashboard KPIs computed from live pipeline data.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const [allGrants, crawlRuns] = await Promise.all([getGrants(), getCrawlRuns()]);

  const activeGrants = allGrants.filter((grant) => grant.status !== "awarded" && grant.status !== "archived");
  const totalPipelineValue = activeGrants.reduce((sum, grant) => sum + (grant.awardSort ?? 0), 0);

  const draftReadyCount = allGrants.filter((grant) => grant.status === "review").length;
  const reviewQueueCount = draftReadyCount;

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines: UpcomingDeadline[] = allGrants
    .filter((grant) => {
      if (grant.status === "archived" || grant.status === "awarded") return false;
      if (grant.deadline === "Rolling") return false;
      const deadline = new Date(grant.deadline);
      return deadline >= now && deadline <= thirtyDaysFromNow;
    })
    .sort((a, b) => a.daysOut - b.daysOut)
    .slice(0, 10)
    .map((grant) => ({
      grant,
      daysOut: grant.daysOut,
      confidence: grant.deadlineConfidence ?? "unknown",
    }));

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentMatches = allGrants
    .filter((grant) => {
      if (!grant.matchedAt || grant.status !== "matched") return false;
      return new Date(grant.matchedAt) >= sevenDaysAgo;
    })
    .slice(0, 5);

  const sortedRuns = [...crawlRuns].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const lastSuccessfulRun = sortedRuns.find((run) => run.status === "completed") ?? null;

  let consecutiveFailures = 0;
  for (const run of sortedRuns) {
    if (run.status === "failed") {
      consecutiveFailures += 1;
      continue;
    }
    if (run.status === "completed") {
      break;
    }
  }

  const lastRun = sortedRuns[0] ?? null;
  const staleDays = lastRun
    ? Math.floor((now.getTime() - new Date(lastRun.startedAt).getTime()) / (24 * 60 * 60 * 1000))
    : null;
  const isStale = lastRun === null || lastRun.status === "failed" || (staleDays !== null && staleDays > 7);

  const crawlHealth: CrawlHealthSummary = {
    lastSuccessfulRun,
    consecutiveFailures,
    isStale,
    staleDays,
  };

  const historical: HistoricalCounts = {
    active: allGrants.filter((grant) => grant.status !== "submitted" && grant.status !== "awarded" && grant.status !== "declined" && grant.status !== "archived").length,
    submitted: allGrants.filter((grant) => grant.status === "submitted").length,
    awarded: allGrants.filter((grant) => grant.status === "awarded").length,
    declined: allGrants.filter((grant) => grant.status === "declined").length,
    archived: allGrants.filter((grant) => grant.status === "archived").length,
  };

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStats: PeriodStats = {
    matchedThisMonth: allGrants.filter((grant) => {
      if (!grant.matchedAt) return false;
      return new Date(grant.matchedAt) >= firstOfMonth;
    }).length,
    submittedThisMonth: allGrants.filter((grant) => grant.status === "submitted").length,
    awardedThisMonth: allGrants.filter((grant) => grant.status === "awarded").length,
  };

  return {
    totalPipelineValue,
    activeGrantCount: activeGrants.length,
    draftReadyCount,
    reviewQueueCount,
    upcomingDeadlines,
    recentMatches,
    crawlHealth,
    historical,
    periodStats,
  };
}

/**
 * Format deadline for display with confidence indicator.
 */
export function formatDeadlineWithConfidence(
  deadline: string,
  confidence: Grant["deadlineConfidence"],
): string {
  if (deadline === "Rolling") return "Rolling";

  switch (confidence) {
    case "exact":
      return deadline;
    case "estimated":
      return `~${deadline}`;
    case "rolling":
      return "Rolling";
    case "unknown":
    default:
      return `?${deadline}`;
  }
}

/**
 * Get deadline urgency based on confidence and days out.
 */
export function getDeadlineUrgency(
  daysOut: number,
  confidence: Grant["deadlineConfidence"],
): "critical" | "warning" | "normal" | "info" {
  if (confidence === "rolling" || confidence === "unknown") return "info";
  if (daysOut < 0) return "critical";
  if (daysOut <= 7) return "critical";
  if (daysOut <= 14) return "warning";
  if (daysOut <= 30) return "normal";
  return "info";
}

/**
 * Export grants as CSV.
 */
export function exportGrantsToCsv(grants: Grant[]): CsvExport {
  const headers = [
    "Title",
    "Funder",
    "Award",
    "Deadline",
    "Confidence",
    "Days Out",
    "Fit Score",
    "Status",
    "Tags",
    "Funder Short",
  ];

  const rows = grants.map((grant) => [
    grant.title,
    grant.funder,
    grant.award,
    grant.deadline,
    grant.deadlineConfidence ?? "unknown",
    String(grant.daysOut),
    String(grant.fit),
    grant.statusLabel,
    grant.tags.join("; "),
    grant.funderShort,
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `grant-ops-export-${date}.csv`;

  return { headers, rows, filename };
}

/**
 * Export pipeline as CSV (subset of grant fields for pipeline view).
 */
export function exportPipelineToCsv(grants: Grant[]): CsvExport {
  const headers = [
    "Title",
    "Funder",
    "Award",
    "Deadline",
    "Status",
    "Responsibility",
    "Fit Score",
  ];

  const rows = grants.map((grant) => [
    grant.title,
    grant.funder,
    grant.award,
    grant.deadline,
    grant.statusLabel,
    grant.responsibilityTag ?? "",
    String(grant.fit),
  ]);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `grant-ops-pipeline-${date}.csv`;

  return { headers, rows, filename };
}

export interface PipelineReportRow {
  title: string;
  funder: string;
  status: string;
  deadline: string;
  awardAmount: number;
  daysOut: number;
  responsibilityTag: string;
}

export function generatePipelineReport(grants: Grant[]): PipelineReportRow[] {
  return grants
    .filter((g) => g.status !== "awarded" && g.status !== "archived" && g.status !== "declined")
    .map((grant) => ({
      title: grant.title,
      funder: grant.funder,
      status: grant.statusLabel,
      deadline: grant.deadline,
      awardAmount: grant.awardSort ?? 0,
      daysOut: grant.daysOut,
      responsibilityTag: grant.responsibilityTag ?? "",
    }));
}

export interface FundraisingForecast {
  projectedSubmissions90d: number;
  projectedAwardValue: number;
  atRiskGrants: Grant[];
}

export function generateFundraisingForecast(grants: Grant[]): FundraisingForecast {
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const projectedSubmissions90d = grants.filter((g) => {
    if (g.deadline === "Rolling") return false;
    const deadline = new Date(g.deadline);
    return (
      (g.status === "approved" || g.status === "submission-ready") &&
      deadline >= now &&
      deadline <= ninetyDaysFromNow
    );
  }).length;

  // Calculate historical success rate over trailing 24 months
  const twentyFourMonthsAgo = new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000);
  const submittedCount = grants.filter(
    (g) => g.status === "submitted" && g.matchedAt && new Date(g.matchedAt) >= twentyFourMonthsAgo,
  ).length;
  const awardedCount = grants.filter(
    (g) => g.status === "awarded" && g.matchedAt && new Date(g.matchedAt) >= twentyFourMonthsAgo,
  ).length;

  const historicalSuccessRate = submittedCount >= 5 ? awardedCount / submittedCount : 0;

  const projectedAwardValue = grants
    .filter((g) => g.status === "approved" || g.status === "submission-ready")
    .reduce((sum, g) => sum + (g.awardSort ?? 0) * historicalSuccessRate, 0);

  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const atRiskGrants = grants.filter((g) => {
    if (g.deadline === "Rolling") return false;
    const deadline = new Date(g.deadline);
    return (
      deadline < fourteenDaysFromNow &&
      !["submitted", "awarded", "declined", "archived"].includes(g.status)
    );
  });

  return {
    projectedSubmissions90d,
    projectedAwardValue,
    atRiskGrants,
  };
}

export interface AnnualSummaryLesson {
  grantTitle: string;
  funder: string;
  note: string;
}

export interface AnnualSummary {
  totalGrantsSubmitted: number;
  totalAwarded: number;
  successRate: number;
  topFunders: { funder: string; totalAwarded: number }[];
  lessonsLearned: AnnualSummaryLesson[];
}

export function generateAnnualSummary(grants: Grant[]): AnnualSummary {
  const totalGrantsSubmitted = grants.filter((g) => g.status === "submitted" || g.status === "awarded").length;
  const totalAwarded = grants.filter((g) => g.status === "awarded").length;
  const successRate = totalGrantsSubmitted > 0 ? totalAwarded / totalGrantsSubmitted : 0;

  const funderTotals = new Map<string, number>();
  grants
    .filter((g) => g.status === "awarded")
    .forEach((g) => {
      const current = funderTotals.get(g.funder) ?? 0;
      funderTotals.set(g.funder, current + (g.awardSort ?? 0));
    });

  const topFunders = Array.from(funderTotals.entries())
    .map(([funder, totalAwarded]) => ({ funder, totalAwarded }))
    .sort((a, b) => b.totalAwarded - a.totalAwarded)
    .slice(0, 5);

  const lessonsLearned = grants
    .filter((g) => g.status === "declined" && g.lessonsLearned && g.lessonsLearned.trim().length > 0)
    .map((g) => ({
      grantTitle: g.title,
      funder: g.funder,
      note: g.lessonsLearned!,
    }));

  return {
    totalGrantsSubmitted,
    totalAwarded,
    successRate,
    topFunders,
    lessonsLearned,
  };
}
