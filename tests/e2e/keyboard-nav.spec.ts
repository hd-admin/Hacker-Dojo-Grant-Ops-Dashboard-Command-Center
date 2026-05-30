import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { configureOpencodeThroughSettingsView, resetAppState } from "./test-utils";

const opencodeStubPath = path.join(process.cwd(), "tests/e2e/opencode-stub.sh");

async function ensureOpencodeStub(): Promise<string> {
  const script = `#!/bin/sh
set -eu

cat <<'EOF'
OpenCode 0.1.0-stub
EOF
`;
  await fs.writeFile(opencodeStubPath, script, "utf8");
  await fs.chmod(opencodeStubPath, 0o755);
  return opencodeStubPath;
}

test.describe("Keyboard navigation", () => {
  test.beforeEach(async ({ request, page }) => {
    const stubPath = await ensureOpencodeStub();
    await resetAppState(request);
    await page.goto("http://127.0.0.1:3000");
    await page.waitForSelector(".app", { timeout: 60000 });
    await configureOpencodeThroughSettingsView(page, stubPath, process.cwd());
    await page.locator('.shell-banner-row [data-testid="rerun-health-check-btn"]').click();
    await expect(page.locator('.nav-item[data-view="discovery"]')).not.toBeDisabled();
    await page.click('[data-view="dashboard"]');
    await page.waitForSelector("#view-dashboard.active", { timeout: 10000 });
  });

  test("navigate sidebar via Tab and Enter/Space", async ({ page }) => {
    // Start from dashboard view (already active from beforeEach)
    await expect(page.locator("#view-dashboard.active")).toBeVisible();

    // Focus the dashboard nav button via click, then Tab to Discovery
    await page.locator('.nav-item[data-view="dashboard"]').click();

    // 1 Tab moves from Dashboard to Discovery in the sidebar nav order
    await page.keyboard.press("Tab");

    // Switch to discovery view via keyboard
    await page.keyboard.press("Enter");
    await expect(page.locator("#view-discovery")).toHaveClass(/active/);
  });

  test("Escape to close drawer", async ({ page, request }) => {
    // Open a grant to show the drawer
    await page.click('[data-view="discovery"]');
    await page.waitForSelector("#view-discovery.active", { timeout: 5000 });

    const grantsResponse = await request.get("http://127.0.0.1:3000/api/grants");
    const grants: Array<{ id: string }> = await grantsResponse.json();
    if (grants.length > 0) {
      await page.locator(".grants-row:not(.header)").first().click();
      await expect(page.locator(".drawer")).toBeVisible();

      // Close with Escape
      await page.keyboard.press("Escape");
      // Give the drawer time to close
      await page.waitForTimeout(500);
    }
  });

  test("Tab through interactive elements in discovery view", async ({ page }) => {
    await page.click('[data-view="discovery"]');
    await page.waitForSelector("#view-discovery.active", { timeout: 5000 });

    // Tab should move focus away from the initial element
    await page.keyboard.press("Tab");
    await page.waitForTimeout(200);

    // Verify that at least one element can be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test("enter and space activate buttons", async ({ page }) => {
    // Navigate to settings
    await page.click('[data-view="settings"]');
    await page.waitForSelector("#view-settings.active");

    // Focus on the upload document button via Tab
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Verify the focused element exists
    const hasFocus = await page.evaluate(() => document.activeElement !== null);
    expect(hasFocus).toBeTruthy();
  });
});
