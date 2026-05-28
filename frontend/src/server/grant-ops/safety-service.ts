/**
 * Safety Service - App Lock & High-Impact Action Protections
 *
 * Provides hashed passcode verification, lock configuration management,
 * idle/lock-on-launch settings, and audit trail for destructive actions.
 *
 * This module runs server-side and is consumed by API routes.
 */

import crypto from "node:crypto";

// ============ Types ============

export interface LockConfig {
  /** Whether app lock is enabled at all */
  enabled: boolean;
  /** Lock immediately when the app launches */
  lockOnLaunch: boolean;
  /** Lock after N milliseconds of user idle time (0 = disabled) */
  lockOnIdleMs: number;
  /** Maximum failed attempts before lockout (0 = unlimited) */
  maxFailedAttempts: number;
  /** Cooldown period in ms after max failed attempts */
  lockoutCooldownMs: number;
}

export interface SafetyAuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorLabel: string;
  timestamp: string;
  consequence: string;
  metadata?: Record<string, unknown>;
}

export const DEFAULT_LOCK_CONFIG: LockConfig = {
  enabled: false,
  lockOnLaunch: false,
  lockOnIdleMs: 0,
  maxFailedAttempts: 5,
  lockoutCooldownMs: 300_000, // 5 minutes
};

// ============ In-memory storage (server-side) ============

let passcodeHash: string | null = null;
let lockConfig: LockConfig = { ...DEFAULT_LOCK_CONFIG };
let failedAttempts = 0;
let lockoutUntil: number | null = null;
const auditTrail: SafetyAuditEntry[] = [];

let instanceId = crypto.randomUUID();

// ============ Passcode Management ============

const PBKDF2_ITERATIONS = 310_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

function generateSalt(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a passcode using PBKDF2 with a random salt.
 * Returns "salt:hash" format for storage.
 */
export async function hashPasscode(passcode: string): Promise<string> {
  const salt = generateSalt();
  return new Promise<string>((resolve, reject) => {
    crypto.pbkdf2(
      passcode,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(`${salt}:${derivedKey.toString("hex")}`);
      },
    );
  });
}

/**
 * Verify a passcode against a stored hash.
 */
export async function verifyPasscode(
  passcode: string,
  hash: string,
): Promise<boolean> {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) return false;

  return new Promise<boolean>((resolve, reject) => {
    crypto.pbkdf2(
      passcode,
      salt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST,
      (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        // Constant-time comparison
        const a = Buffer.from(derivedKey.toString("hex"), "utf8");
        const b = Buffer.from(storedHash, "utf8");
        if (a.length !== b.length) {
          resolve(false);
          return;
        }
        resolve(crypto.timingSafeEqual(a, b));
      },
    );
  });
}

// ============ App Lock State ============

/**
 * Set (or update) the app passcode. Returns the hash for storage.
 */
export async function setPasscode(passcode: string): Promise<string> {
  passcodeHash = await hashPasscode(passcode);
  failedAttempts = 0;
  lockoutUntil = null;
  recordAudit("passcode_set", "safety", instanceId, "system", "Passcode configured");
  return passcodeHash;
}

/**
 * Check if a passcode has been set.
 */
export function isPasscodeSet(): boolean {
  return passcodeHash !== null;
}

/**
 * Attempt to unlock with the given passcode.
 * Returns { success: boolean, reason?: string }
 */
export async function attemptUnlock(
  passcode: string,
): Promise<{ success: boolean; reason?: string }> {
  if (!passcodeHash) {
    return { success: false, reason: "No passcode has been configured." };
  }

  // Check lockout
  if (lockoutUntil !== null && Date.now() < lockoutUntil) {
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
    return {
      success: false,
      reason: `Too many failed attempts. Try again in ${remaining}s.`,
    };
  }

  const isValid = await verifyPasscode(passcode, passcodeHash);

  if (!isValid) {
    failedAttempts += 1;
    recordAudit(
      "unlock_failed",
      "safety",
      instanceId,
      "user",
      `Failed attempt ${failedAttempts}`,
    );

    if (
      lockConfig.maxFailedAttempts > 0 &&
      failedAttempts >= lockConfig.maxFailedAttempts
    ) {
      lockoutUntil = Date.now() + lockConfig.lockoutCooldownMs;
      recordAudit(
        "lockout_triggered",
        "safety",
        instanceId,
        "system",
        `Lockout triggered after ${failedAttempts} failed attempts`,
      );
      return {
        success: false,
        reason: `Account locked. Try again in ${Math.ceil(lockConfig.lockoutCooldownMs / 1000)}s.`,
      };
    }

    return { success: false, reason: "Incorrect passcode." };
  }

  // Successful unlock
  failedAttempts = 0;
  lockoutUntil = null;
  recordAudit("unlock_success", "safety", instanceId, "user", "App unlocked");
  return { success: true };
}

/**
 * Get the current lock configuration.
 */
export function getLockConfig(): LockConfig {
  return { ...lockConfig };
}

/**
 * Update the lock configuration.
 */
export function updateLockConfig(
  updates: Partial<LockConfig>,
): LockConfig {
  lockConfig = { ...lockConfig, ...updates };
  recordAudit(
    "lock_config_updated",
    "safety",
    instanceId,
    "user",
    `Lock config: ${JSON.stringify(updates)}`,
  );
  return getLockConfig();
}

/**
 * Clear the passcode and disable lock.
 */
export function disableLock(): void {
  passcodeHash = null;
  lockConfig = { ...DEFAULT_LOCK_CONFIG };
  failedAttempts = 0;
  lockoutUntil = null;
  recordAudit("lock_disabled", "safety", instanceId, "user", "Lock disabled and passcode cleared");
}

/**
 * Reset the instance (for testing).
 */
export function resetSafetyService(): void {
  passcodeHash = null;
  lockConfig = { ...DEFAULT_LOCK_CONFIG };
  failedAttempts = 0;
  lockoutUntil = null;
  auditTrail.length = 0;
  instanceId = crypto.randomUUID();
}

// ============ Audit Trail ============

export function recordAudit(
  action: string,
  entityType: string,
  entityId: string,
  actorLabel: string,
  consequence: string,
  metadata?: Record<string, unknown>,
): SafetyAuditEntry {
  const entry: SafetyAuditEntry = {
    id: crypto.randomUUID(),
    action,
    entityType,
    entityId,
    actorLabel,
    timestamp: new Date().toISOString(),
    consequence,
    metadata,
  };
  auditTrail.push(entry);

  // Keep only last 500 entries
  if (auditTrail.length > 500) {
    auditTrail.splice(0, auditTrail.length - 500);
  }

  return entry;
}

export function getAuditTrail(limit = 50): SafetyAuditEntry[] {
  return auditTrail.slice(-limit).reverse();
}

// ============ High-Impact Action Confirmation ============

export interface ActionConfirmation {
  action: string;
  entityId: string;
  entityType: string;
  consequence: string;
  requiresConfirmation: boolean;
  confirmationPrompt: string;
}

const HIGH_IMPACT_ACTIONS: Record<string, (entityId: string) => ActionConfirmation> = {
  delete_source: (id: string) => ({
    action: "delete_source",
    entityId: id,
    entityType: "source",
    consequence: "This will permanently remove the source and all associated crawl data. Grant data already imported will not be affected.",
    requiresConfirmation: true,
    confirmationPrompt: "Type DELETE to confirm permanent removal of this source.",
  }),
  delete_grant: (id: string) => ({
    action: "delete_grant",
    entityId: id,
    entityType: "grant",
    consequence: "This will permanently remove the grant and all associated drafts, checklists, and audit history.",
    requiresConfirmation: true,
    confirmationPrompt: "Type DELETE to confirm permanent removal of this grant and all associated data.",
  }),
  restore_backup: () => ({
    action: "restore_backup",
    entityId: "global",
    entityType: "backup",
    consequence: "Restoring a backup will overwrite ALL current data including grants, sources, and drafts. This action cannot be undone.",
    requiresConfirmation: true,
    confirmationPrompt: "Type RESTORE to confirm data restoration. This will overwrite all current data.",
  }),
  submit_grant: (id: string) => ({
    action: "submit_grant",
    entityId: id,
    entityType: "grant",
    consequence: "Submitting a grant application is a binding action. Verify all checklist items are complete and the draft is approved.",
    requiresConfirmation: true,
    confirmationPrompt: "Are you sure you want to submit this grant application?",
  }),
};

export function getConfirmationForAction(
  action: string,
  entityId: string,
): ActionConfirmation | null {
  const factory = HIGH_IMPACT_ACTIONS[action];
  if (!factory) return null;
  return factory(entityId);
}
