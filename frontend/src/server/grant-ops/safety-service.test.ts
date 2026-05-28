import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  attemptUnlock,
  disableLock,
  getAuditTrail,
  getConfirmationForAction,
  getLockConfig,
  isPasscodeSet,
  resetSafetyService,
  setPasscode,
  updateLockConfig,
} from "./safety-service";

describe("safety-service", () => {
  beforeEach(() => {
    resetSafetyService();
  });

  afterEach(() => {
    resetSafetyService();
  });

  describe("setPasscode", () => {
    it("hashes and stores a passcode", async () => {
      const hash = await setPasscode("my-secret-123");
      expect(hash).toBeTruthy();
      expect(hash).toContain(":");
      expect(isPasscodeSet()).toBe(true);
    });

    it("replaces an existing passcode", async () => {
      const hash1 = await setPasscode("first-passcode");
      expect(isPasscodeSet()).toBe(true);
      const hash2 = await setPasscode("second-passcode");
      expect(hash2).not.toBe(hash1);
      expect(isPasscodeSet()).toBe(true);
    });
  });

  describe("attemptUnlock", () => {
    it("succeeds with correct passcode", async () => {
      await setPasscode("hunter2");
      const result = await attemptUnlock("hunter2");
      expect(result.success).toBe(true);
    });

    it("fails with incorrect passcode", async () => {
      await setPasscode("correct");
      const result = await attemptUnlock("wrong");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("Incorrect passcode.");
    });

    it("fails when no passcode is set", async () => {
      const result = await attemptUnlock("anything");
      expect(result.success).toBe(false);
      expect(result.reason).toBe("No passcode has been configured.");
    });

    it("triggers lockout after max failed attempts", async () => {
      await setPasscode("secret");
      updateLockConfig({ maxFailedAttempts: 3, lockoutCooldownMs: 10000 });

      await attemptUnlock("wrong1");
      await attemptUnlock("wrong2");
      const result = await attemptUnlock("wrong3");

      expect(result.success).toBe(false);
      expect(result.reason).toContain("Account locked");

      // Even correct passcode should fail during lockout
      const lockedResult = await attemptUnlock("secret");
      expect(lockedResult.success).toBe(false);
      expect(lockedResult.reason).toContain("Try again in");
    });

    it("resets failed attempts after successful unlock", async () => {
      await setPasscode("secret");
      updateLockConfig({ maxFailedAttempts: 3 });

      await attemptUnlock("wrong1");
      await attemptUnlock("wrong2");

      const successResult = await attemptUnlock("secret");
      expect(successResult.success).toBe(true);

      // Should have reset, so another wrong attempt starts fresh
      const wrongResult = await attemptUnlock("wrong-again");
      expect(wrongResult.success).toBe(false);
      expect(wrongResult.reason).toBe("Incorrect passcode.");

      // Still should be below max attempts
      const correctAgain = await attemptUnlock("secret");
      expect(correctAgain.success).toBe(true);
    });

    it("allows unlimited attempts when maxFailedAttempts is 0", async () => {
      await setPasscode("secret");
      updateLockConfig({ maxFailedAttempts: 0 });

      for (let i = 0; i < 20; i++) {
        await attemptUnlock("wrong");
      }

      const result = await attemptUnlock("secret");
      expect(result.success).toBe(true);
    });
  });

  describe("lock configuration", () => {
    it("returns default config initially", () => {
      const config = getLockConfig();
      expect(config.enabled).toBe(false);
      expect(config.lockOnLaunch).toBe(false);
      expect(config.lockOnIdleMs).toBe(0);
      expect(config.maxFailedAttempts).toBe(5);
      expect(config.lockoutCooldownMs).toBe(300_000);
    });

    it("updates config partially", () => {
      updateLockConfig({ enabled: true, lockOnLaunch: true });
      const config = getLockConfig();
      expect(config.enabled).toBe(true);
      expect(config.lockOnLaunch).toBe(true);
      expect(config.lockOnIdleMs).toBe(0); // unchanged
    });

    it("disables lock completely", async () => {
      await setPasscode("test");
      updateLockConfig({ enabled: true });
      expect(isPasscodeSet()).toBe(true);

      disableLock();
      expect(isPasscodeSet()).toBe(false);
      expect(getLockConfig().enabled).toBe(false);
    });
  });

  describe("audit trail", () => {
    it("records passcode set events", async () => {
      await setPasscode("test123");
      const trail = getAuditTrail();
      expect(trail.length).toBeGreaterThan(0);
      expect(trail[0]!.action).toBe("passcode_set");
    });

    it("records failed unlock attempts", async () => {
      await setPasscode("test");
      await attemptUnlock("wrong");
      const trail = getAuditTrail();
      const failedEntry = trail.find((e) => e.action === "unlock_failed");
      expect(failedEntry).toBeDefined();
      expect(failedEntry!.consequence).toContain("Failed attempt");
    });

    it("records successful unlocks", async () => {
      await setPasscode("test");
      await attemptUnlock("test");
      const trail = getAuditTrail();
      const successEntry = trail.find((e) => e.action === "unlock_success");
      expect(successEntry).toBeDefined();
    });

    it("limits audit trail to 500 entries", async () => {
      await setPasscode("test");
      for (let i = 0; i < 10; i++) {
        await attemptUnlock(i % 2 === 0 ? "test" : "wrong");
      }
      const trail = getAuditTrail(1000);
      expect(trail.length).toBeLessThanOrEqual(500);
    });
  });

  describe("high-impact action confirmation", () => {
    it("returns confirmation for delete_source", () => {
      const confirm = getConfirmationForAction("delete_source", "src-1");
      expect(confirm).not.toBeNull();
      expect(confirm!.requiresConfirmation).toBe(true);
      expect(confirm!.consequence).toContain("permanently remove");
    });

    it("returns confirmation for restore_backup", () => {
      const confirm = getConfirmationForAction("restore_backup", "global");
      expect(confirm).not.toBeNull();
      expect(confirm!.consequence).toContain("overwrite ALL current data");
    });

    it("returns confirmation for submit_grant", () => {
      const confirm = getConfirmationForAction("submit_grant", "grant-1");
      expect(confirm).not.toBeNull();
      expect(confirm!.action).toBe("submit_grant");
    });

    it("returns null for unknown action", () => {
      const confirm = getConfirmationForAction("unknown_action", "x");
      expect(confirm).toBeNull();
    });
  });
});
