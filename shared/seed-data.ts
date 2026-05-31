/**
 * Shared Bootstrap Templates
 *
 * Minimal default values used to initialize the grant operations system.
 * These are schema-driven templates for SQLite initialization only.
 * No grant data, notification data, or task data is seeded.
 *
 * GAP-05: Eliminates fake/seed data from production paths.
 */

import type { OpencodeSettings } from "./types";

// Import the hardcoded Hacker Dojo profile as the default organization profile.
// This is the authoritative org profile — no user configuration needed.
export { HARDCODED_PROFILE as defaultProfile } from "../frontend/src/server/grant-ops/hardcoded-profile";

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
