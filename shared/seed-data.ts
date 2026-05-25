/**
 * Shared Seed Data
 *
 * Canonical default values used to initialize the grant operations system.
 * This module is the single source of truth for seed data used by the
 * Next.js API repository and persistence layer.
 *
 * GAP-05: Eliminates duplication in seed data.
 */

import type {
	ChecklistItem,
	FitScoreBreakdown,
	Grant,
	Notification,
	OpencodeSettings,
	OrganizationProfile,
	Task,
} from "./types";

export const defaultOpencodeSettings: OpencodeSettings = {
	binaryPath: "",
	workingDirectory: "",
	timeoutMs: 60000,
	isConfigured: false,
};

export const defaultProfile: OrganizationProfile = {
	legalName: "Hacker Dojo, a California nonprofit corporation",
	ein: "26-3375350",
	samUEI: "XK7N4HQ2P3M9",
	mission:
		"Hacker Dojo is a nonprofit that provides free or low-cost technology education, mentorship, and community infrastructure to underserved youth and adults in the Bay Area. We believe talent is evenly distributed, but opportunity is not.",
	docTypes: ["PDF", "XLS", "DOC"],
	searchThemes: [
		"Makerspaces",
		"AI literacy",
		"Community innovation",
		"Workforce development",
		"STEM equity",
		"Digital inclusion",
		"Informal STEM",
		"Bay Area/Silicon Valley",
	],
	agentBehavior: {
		autoDraftThreshold: 75,
		submissionPolicy: "Human approval required",
		notifyEmail: "ed@hackerdojo.com",
		voiceAndTone:
			"Plain-spoken, evidence-led, builder-community framing. Avoid jargon. Lead with outcomes.",
	},
};

// Seed grants used when no persisted data file exists.
// These match the prototype's grant pipeline state.
export const seedGrants: Grant[] = [
	{
		id: "nsf-techaccess",
		title: "NSF Technology Access and Adoption Program",
		funder: "National Science Foundation",
		funderShort: "NSF",
		award: "$350,000",
		awardSort: 350000,
		deadline: "2026-06-15",
		daysOut: 25,
		fit: 88,
		tags: ["Science & Tech", "Federal", "EdTech"],
		status: "draft",
		statusLabel: "Drafting",
		matchedAt: "2026-05-19",
		fitBreakdown: {
			missionAlignment: 96,
			geographicFocus: 90,
			programTrackrecord: 88,
			budgetCapacity: 82,
			partnershipReadiness: 78,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{
				label: "Letter of Intent (3 pages, agent-drafted)",
				done: true,
				source: "Ready for review",
			},
			{
				label: "Project summary & specific aims",
				done: true,
				source: "Drafted",
			},
			{
				label:
					"3 letters of partnership (Mountain View Library, Foothill, Code2College)",
				done: false,
				source: "Outreach drafted",
			},
			{
				label: "Logic model + evaluation plan",
				done: false,
				source: "In progress",
			},
			{
				label: "Detailed budget & budget justification",
				done: false,
				source: "Awaits ED input",
			},
		],
		draftContent: `Hacker Dojo proposes to anchor the Silicon Valley AI-Ready Hub...`,
		externalUrl: "https://www.nsf.gov/funding/pgm_summ.jsp?pims_id=505734",
	},
	{
		id: "sv-community-fdn",
		title: "Silicon Valley Community Foundation Innovation Fund",
		funder: "Silicon Valley Community Foundation",
		funderShort: "SVCF",
		award: "$75,000",
		awardSort: 75000,
		deadline: "Rolling",
		daysOut: 0,
		fit: 82,
		tags: ["Community", "Foundation"],
		status: "draft",
		statusLabel: "Drafting",
		matchedAt: "2026-05-20",
		fitBreakdown: {
			missionAlignment: 90,
			geographicFocus: 95,
			programTrackrecord: 85,
			budgetCapacity: 70,
			partnershipReadiness: 75,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Logic model", done: true, source: "Complete" },
			{ label: "Board roster + bios", done: true, source: "On file" },
			{ label: "Audit financials", done: false, source: "Requested from CPA" },
		],
		draftContent: `Hacker Dojo's Innovation Fund proposal focuses on expanding our AI literacy programming...`,
	},
	{
		id: "dell-equality",
		title: "Dell Technologies Equality Fund",
		funder: "Dell Technologies Foundation",
		funderShort: "Dell",
		award: "$150,000",
		awardSort: 150000,
		deadline: "2026-07-01",
		daysOut: 41,
		fit: 76,
		tags: ["Corporate", "EdTech"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-18",
		fitBreakdown: {
			missionAlignment: 85,
			geographicFocus: 80,
			programTrackrecord: 82,
			budgetCapacity: 75,
			partnershipReadiness: 65,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{
				label: "Dell volunteer MOU",
				done: false,
				source: "Pending legal review",
			},
			{ label: "Impact metrics one-pager", done: true, source: "Complete" },
		],
	},
	{
		id: "google-cs-first",
		title: "Google CS First Expansion Grant",
		funder: "Google.org",
		funderShort: "Google",
		award: "$100,000",
		awardSort: 100000,
		deadline: "2026-06-30",
		daysOut: 40,
		fit: 79,
		tags: ["Science & Tech", "Corporate", "EdTech"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-17",
		fitBreakdown: {
			missionAlignment: 88,
			geographicFocus: 85,
			programTrackrecord: 80,
			budgetCapacity: 72,
			partnershipReadiness: 70,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{
				label: "Google nonprofit status confirmed",
				done: true,
				source: "Confirmed",
			},
			{ label: "Teacher recruitment plan", done: false, source: "Drafting" },
		],
		draftContent: `Google CS First has been a valued partner in our after-school computing program...`,
	},
	{
		id: "kresge-space",
		title: "Kresge Foundation Learning Spaces Initiative",
		funder: "Kresge Foundation",
		funderShort: "Kresge",
		award: "$200,000",
		awardSort: 200000,
		deadline: "2026-08-15",
		daysOut: 86,
		fit: 71,
		tags: ["Community", "Foundation"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-15",
		fitBreakdown: {
			missionAlignment: 78,
			geographicFocus: 75,
			programTrackrecord: 72,
			budgetCapacity: 68,
			partnershipReadiness: 62,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{
				label: "Space renovation plans",
				done: false,
				source: "Pending architect",
			},
			{
				label: "Community input documentation",
				done: true,
				source: "Complete",
			},
		],
		draftContent: `This proposal focuses on transforming Hacker Dojo's main space in Mountain View...`,
	},
	{
		id: "wwf-stem-equity",
		title: "World Wildlife Fund STEM Equity Initiative",
		funder: "World Wildlife Fund",
		funderShort: "WWF",
		award: "$125,000",
		awardSort: 125000,
		deadline: "2026-07-15",
		daysOut: 55,
		fit: 68,
		tags: ["Science & Tech", "Foundation"],
		status: "matched",
		statusLabel: "Matched",
		matchedAt: "2026-05-16",
		fitBreakdown: {
			missionAlignment: 72,
			geographicFocus: 65,
			programTrackrecord: 70,
			budgetCapacity: 75,
			partnershipReadiness: 58,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{
				label: "Environmental focus integration plan",
				done: false,
				source: "In progress",
			},
		],
		draftContent: `While WWF is known for conservation, this initiative recognizes that environmental justice...`,
	},
	{
		id: "morrell-fdn",
		title: "Morrell Family Foundation General Support",
		funder: "Morrell Family Foundation",
		funderShort: "Morrell",
		award: "$50,000",
		awardSort: 50000,
		deadline: "2026-06-01",
		daysOut: 11,
		fit: 84,
		tags: ["Community", "Foundation"],
		status: "draft",
		statusLabel: "Drafting",
		matchedAt: "2026-05-10",
		fitBreakdown: {
			missionAlignment: 88,
			geographicFocus: 82,
			programTrackrecord: 85,
			budgetCapacity: 80,
			partnershipReadiness: 72,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "LOI submission", done: true, source: "May 1" },
			{ label: "Full proposal draft", done: false, source: "In progress" },
			{ label: "Board chair signature", done: false, source: "Pending" },
		],
		draftContent: `The Morrell Family Foundation has long supported grassroots community organizations...`,
	},
	{
		id: "stanford-recovery",
		title: "Stanford Recovery Act Community Grants",
		funder: "Stanford University",
		funderShort: "Stanford",
		award: "$60,000",
		awardSort: 60000,
		deadline: "2026-06-20",
		daysOut: 30,
		fit: 77,
		tags: ["Science & Tech", "Federal"],
		status: "draft",
		statusLabel: "Drafting",
		matchedAt: "2026-05-08",
		fitBreakdown: {
			missionAlignment: 80,
			geographicFocus: 85,
			programTrackrecord: 78,
			budgetCapacity: 72,
			partnershipReadiness: 70,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Stanford partner letter", done: false, source: "Requested" },
			{ label: "Proposal narrative", done: false, source: "Drafting" },
		],
		draftContent: `Stanford's Community Grants program supports organizations advancing economic recovery...`,
	},
	{
		id: "horizon-ed",
		title: "Horizon Education Grants",
		funder: "Horizon Therapeutics",
		funderShort: "Horizon",
		award: "$90,000",
		awardSort: 90000,
		deadline: "2026-06-10",
		daysOut: 20,
		fit: 81,
		tags: ["EdTech", "Corporate"],
		status: "review",
		statusLabel: "Review",
		matchedAt: "2026-05-05",
		fitBreakdown: {
			missionAlignment: 85,
			geographicFocus: 78,
			programTrackrecord: 82,
			budgetCapacity: 79,
			partnershipReadiness: 74,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Full proposal", done: true, source: "Complete" },
			{ label: "Budget narrative", done: true, source: "Complete" },
			{ label: "Logic model", done: true, source: "Complete" },
			{ label: "Organizational chart", done: true, source: "On file" },
			{ label: "Staff bios", done: true, source: "On file" },
			{ label: "ED review", done: false, source: "Scheduled May 22" },
		],
		draftContent: `Horizon Education Grants support innovative approaches to STEM education...`,
	},
	{
		id: "mellon-humanities",
		title: "Mellon Foundation Humanities & Justice Grants",
		funder: "Andrew W. Mellon Foundation",
		funderShort: "Mellon",
		award: "$175,000",
		awardSort: 175000,
		deadline: "2026-07-30",
		daysOut: 70,
		fit: 73,
		tags: ["Community", "Foundation"],
		status: "review",
		statusLabel: "Review",
		matchedAt: "2026-05-01",
		fitBreakdown: {
			missionAlignment: 78,
			geographicFocus: 72,
			programTrackrecord: 75,
			budgetCapacity: 70,
			partnershipReadiness: 68,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Humanities focus integration", done: true, source: "Complete" },
			{
				label: "Community partner letters",
				done: false,
				source: "Awaiting response",
			},
		],
		draftContent: `The Mellon Foundation's Humanities & Justice program aligns with our belief that technology education...`,
	},
	{
		id: "fcc-digital",
		title: "FCC Digital Equity Act Grants",
		funder: "Federal Communications Commission",
		funderShort: "FCC",
		award: "$250,000",
		awardSort: 250000,
		deadline: "2026-05-15",
		daysOut: -6,
		fit: 86,
		tags: ["Federal", "Community"],
		status: "submitted",
		statusLabel: "Submitted",
		matchedAt: "2026-04-20",
		fitBreakdown: {
			missionAlignment: 92,
			geographicFocus: 88,
			programTrackrecord: 85,
			budgetCapacity: 80,
			partnershipReadiness: 82,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Full proposal submitted", done: true, source: "May 10" },
			{ label: "Budget narrative", done: true, source: "Complete" },
			{ label: "Letters of support (7)", done: true, source: "All received" },
		],
		draftContent: `The FCC Digital Equity Act aims to ensure all Americans can fully participate in the digital economy...`,
		externalUrl:
			"https://www.fcc.gov/document/fcc-announces-digital-equity-act-grant-program",
	},
	{
		id: "silicon-valley-campaign",
		title: "Silicon Valley Community Campaign",
		funder: "United Way Silicon Valley",
		funderShort: "United Way",
		award: "$40,000",
		awardSort: 40000,
		deadline: "2026-05-01",
		daysOut: -20,
		fit: 79,
		tags: ["Community", "Foundation"],
		status: "submitted",
		statusLabel: "Submitted",
		matchedAt: "2026-03-15",
		fitBreakdown: {
			missionAlignment: 84,
			geographicFocus: 90,
			programTrackrecord: 82,
			budgetCapacity: 68,
			partnershipReadiness: 72,
		},
		checklist: [
			{
				label: "501(c)(3) verification + EIN",
				done: true,
				source: "From profile",
			},
			{
				label: "SAM.gov registration active",
				done: true,
				source: "Verified Apr 12",
			},
			{ label: "Proposal submitted", done: true, source: "Apr 28" },
		],
		draftContent: `United Way's Community Campaign supports direct service organizations addressing immediate community needs...`,
	},
	{
		id: "dea-youth-prevention",
		title: "DEA Youth Prevention Grants (Closed)",
		funder: "Drug Enforcement Administration",
		funderShort: "DEA",
		award: "$30,000",
		awardSort: 30000,
		deadline: "2025-12-01",
		daysOut: -171,
		fit: 45,
		tags: ["Federal", "Community"],
		status: "awarded",
		statusLabel: "Awarded",
		matchedAt: "2025-09-01",
		fitBreakdown: {
			missionAlignment: 50,
			geographicFocus: 55,
			programTrackrecord: 45,
			budgetCapacity: 40,
			partnershipReadiness: 35,
		},
		checklist: [
			{ label: "Project completed", done: true, source: "Dec 2025" },
			{ label: "Final report submitted", done: true, source: "Jan 2026" },
		],
		draftContent: `This was a historical grant focused on substance abuse prevention education...`,
	},
];

// Seed notifications for initial state
export const seedNotifications: Notification[] = [
	{
		id: "notif-1",
		text: "NSF Technology Access grant deadline in 25 days",
		time: "2 hours ago",
		dot: "NSF",
	},
	{
		id: "notif-2",
		text: "Morrell Family Foundation deadline approaching: 11 days remaining",
		time: "4 hours ago",
		dot: "Morrell",
	},
	{
		id: "notif-3",
		text: "New high-fit grant discovered: Horizon Education Grants (81% fit)",
		time: "1 day ago",
		dot: "New",
	},
];

// Seed tasks for initial state
export const seedTasks: Task[] = [
	{
		id: "task-1",
		text: "Review NSF draft and provide feedback",
		completed: false,
	},
	{
		id: "task-2",
		text: "Collect partnership letters for Silicon Valley Community Foundation",
		completed: false,
	},
	{
		id: "task-3",
		text: "Finalize budget narrative for Horizon Education grant",
		completed: true,
	},
];

export function createDefaultFunderSummary(grant: Pick<Grant, 'funder' | 'title' | 'tags'>): string {
	const theme = grant.tags[0] || 'the organization mission';
	return `${grant.funder} is a strong fit for ${grant.title} because it aligns with ${theme}.`;
}

export function createDefaultFitBreakdown(fit: number): FitScoreBreakdown {
	const boundedFit = Math.max(0, Math.min(100, fit));
	return {
		missionAlignment: Math.min(100, boundedFit + 8),
		geographicFocus: Math.min(100, boundedFit + 4),
		programTrackrecord: Math.max(0, boundedFit - 2),
		budgetCapacity: Math.max(0, boundedFit - 6),
		partnershipReadiness: Math.max(0, boundedFit - 10),
	};
}

export function createDefaultGrantChecklist(grant: Pick<Grant, 'fit' | 'status' | 'draftContent' | 'funderSummary' | 'latestDraftVersion' | 'groundedDocumentCount' | 'sourceCount'>): ChecklistItem[] {
	const hasDraft = Boolean(grant.draftContent) || (grant.latestDraftVersion ?? 0) > 0;
	const hasGrounding = (grant.groundedDocumentCount ?? 0) > 0 || (grant.sourceCount ?? 0) > 0;

	return [
		{
			label: 'Funder summary captured',
			done: Boolean(grant.funderSummary),
			source: 'Prototype detail view',
		},
		{
			label: 'Fit review documented',
			done: grant.fit >= 70,
			source: 'Research scoring',
		},
		{
			label: 'Draft preview ready',
			done: hasDraft,
			source: 'Drafting workflow',
		},
		{
			label: 'Grounded documents counted',
			done: hasGrounding,
			source: 'Document grounding',
		},
		{
			label: 'Submission path reviewed',
			done: grant.status === 'review' || grant.status === 'submitted' || grant.status === 'awarded',
			source: 'Workflow gate',
		},
	];
}

export function normalizeGrantDetailFields(grant: Grant): Grant {
	const normalized: Grant = {
		...grant,
		fitBreakdown: grant.fitBreakdown ?? createDefaultFitBreakdown(grant.fit),
		funderSummary: grant.funderSummary ?? createDefaultFunderSummary(grant),
		latestDraftVersion: grant.latestDraftVersion ?? (grant.draftContent ? 1 : 0),
		groundedDocumentCount: grant.groundedDocumentCount ?? 0,
		sourceCount: grant.sourceCount ?? 0,
	};

	if (!normalized.checklist || normalized.checklist.length === 0) {
		normalized.checklist = createDefaultGrantChecklist(normalized);
	}

	return normalized;
}
