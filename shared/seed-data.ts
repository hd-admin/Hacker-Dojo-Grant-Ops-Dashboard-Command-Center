/**
 * Shared Bootstrap Templates
 *
 * Minimal default values used to initialize the grant operations system.
 * These are schema-driven templates for SQLite initialization only.
 * No grant data, notification data, or task data is seeded.
 *
 * GAP-05: Eliminates fake/seed data from production paths.
 */

import type {
	OpencodeSettings,
	OrganizationProfile,
} from "./types";

/**
 * Bootstrap template for Opencode settings.
 * Used when no settings have been saved yet.
 */
export const defaultOpencodeSettings: OpencodeSettings = {
	binaryPath: "",
	workingDirectory: "",
	timeoutMs: 60000,
	isConfigured: false,
};

/**
 * Bootstrap template for organization profile.
 * Used when no profile has been saved yet.
 * Contains placeholder values that should be replaced with real org data.
 */
export const defaultProfile: OrganizationProfile = {
	legalName: "",
	ein: "",
	samUEI: "",
	nonprofitStatus: "",
	contactInfo: {},
	geography: "",
	mission: "",
	programAreas: [],
	populationsServed: [],
	fundingHistory: [],
	partnerships: [],
	complianceFacts: [],
	docTypes: ["PDF", "XLS", "DOC"],
	searchThemes: [],
	agentBehavior: {
		autoDraftThreshold: 75,
		submissionPolicy: "Human approval required",
		notifyEmail: "",
		voiceAndTone:
			"Plain-spoken, evidence-led, builder-community framing. Avoid jargon. Lead with outcomes.",
	},
};
