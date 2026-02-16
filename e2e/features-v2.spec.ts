/**
 * Feature Board v2 E2E Tests
 * Tests for the enhanced feature board with type selector, filter tabs, and AI verdict badge.
 * Requires migration 002_api_keys_and_features_v2.sql to be applied.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Check if type column exists (migration 002 applied)
async function hasTypeColumn(): Promise<boolean> {
  const { error } = await supabase.from("feature_requests").select("type").limit(1);
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    console.log("⚠️ type column not found - migration 002 not applied");
    return false;
  }
  return true;
}

// Helper to skip test if migration not applied
async function skipIfNoMigration(): Promise<boolean> {
  const hasType = await hasTypeColumn();
  if (!hasType) {
    console.log("⚠️ Skipping: type column not found. Apply migration 002_api_keys_and_features_v2.sql");
    return true;
  }
  return false;
}

test.afterAll(async () => {
  await supabase.from("feature_requests").delete().like("title", "E2E V2 Test%");
});

test.describe("Feature Board v2 - Type Selector", () => {
  test("can submit a feature request with type=feature @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await page.goto("/features");
    await expect(page.getByLabel("Feature Request")).toBeChecked();
    await page.getByPlaceholder("Feature title *").fill("E2E V2 Test Feature Submission");
    await page.getByPlaceholder("Describe the feature (optional)").fill("Testing feature type submission");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("E2E V2 Test Feature Submission")).toBeVisible({ timeout: 10000 });
    await supabase.from("feature_requests").delete().eq("title", "E2E V2 Test Feature Submission");
  });

  test("can submit a bug report with type=bug @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await page.goto("/features");
    await page.getByLabel("Bug Report").click();
    await expect(page.getByLabel("Bug Report")).toBeChecked();
    await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeVisible();
    await page.getByPlaceholder("Bug title *").fill("E2E V2 Test Bug Submission");
    await page.getByPlaceholder("Describe the bug and steps to reproduce (optional)").fill("Testing bug type submission");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("E2E V2 Test Bug Submission")).toBeVisible({ timeout: 10000 });
    await supabase.from("feature_requests").delete().eq("title", "E2E V2 Test Bug Submission");
  });

  test("type selector updates form header and placeholders dynamically @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await page.goto("/features");
    await expect(page.getByRole("heading", { name: "Suggest a Feature" })).toBeVisible();
    await expect(page.getByPlaceholder("Feature title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the feature (optional)")).toBeVisible();

    await page.getByLabel("Bug Report").click();
    await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeVisible();
    await expect(page.getByPlaceholder("Bug title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the bug and steps to reproduce (optional)")).toBeVisible();

    await page.getByLabel("Feature Request").click();
    await expect(page.getByRole("heading", { name: "Suggest a Feature" })).toBeVisible();
    await expect(page.getByPlaceholder("Feature title *")).toBeVisible();
  });
});

test.describe("Feature Board v2 - Filter Tabs", () => {
  test("clicking a tab changes its active state @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await page.goto("/features");
    const allTab = page.getByRole("button", { name: "All" });
    const featuresTab = page.getByRole("button", { name: "Features" });
    const bugsTab = page.getByRole("button", { name: "Bugs" });

    await featuresTab.click();
    await expect(featuresTab).toHaveClass(/bg-shindig-600/);
    await expect(allTab).not.toHaveClass(/bg-shindig-600/);

    await bugsTab.click();
    await expect(bugsTab).toHaveClass(/bg-shindig-600/);
    await expect(featuresTab).not.toHaveClass(/bg-shindig-600/);

    await allTab.click();
    await expect(allTab).toHaveClass(/bg-shindig-600/);
    await expect(bugsTab).not.toHaveClass(/bg-shindig-600/);
  });

  test("Features tab filters to only show features @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Filter%");
    const { data: feature } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Filter Feature Item", type: "feature", status: "open", author_name: "Test"
    }).select().single();
    const { data: bug } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Filter Bug Item", type: "bug", status: "open", author_name: "Test"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("E2E V2 Test Filter Feature Item")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E V2 Test Filter Bug Item")).toBeVisible();

    await page.getByRole("button", { name: "Features" }).click();
    await expect(page.getByText("E2E V2 Test Filter Feature Item")).toBeVisible();
    await expect(page.getByText("E2E V2 Test Filter Bug Item")).not.toBeVisible();

    if (feature) await supabase.from("feature_requests").delete().eq("id", feature.id);
    if (bug) await supabase.from("feature_requests").delete().eq("id", bug.id);
  });

  test("Bugs tab filters to only show bugs @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Bug Tab%");
    const { data: feature } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Bug Tab Feature", type: "feature", status: "open", author_name: "Test"
    }).select().single();
    const { data: bug } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Bug Tab Bug", type: "bug", status: "open", author_name: "Test"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Bugs" }).click();
    await expect(page.getByText("E2E V2 Test Bug Tab Bug")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E V2 Test Bug Tab Feature")).not.toBeVisible();

    if (feature) await supabase.from("feature_requests").delete().eq("id", feature.id);
    if (bug) await supabase.from("feature_requests").delete().eq("id", bug.id);
  });

  test("Approved tab filters to show approved features @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Approved%");
    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Open%");
    const { data: approved } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Approved Item", type: "feature", status: "approved", author_name: "Test"
    }).select().single();
    const { data: open } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Open Item", type: "feature", status: "open", author_name: "Test"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.getByText("E2E V2 Test Approved Item")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E V2 Test Open Item")).not.toBeVisible();

    if (approved) await supabase.from("feature_requests").delete().eq("id", approved.id);
    if (open) await supabase.from("feature_requests").delete().eq("id", open.id);
  });

  test("Needs Review tab filters to show open features @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Review%");
    const { data: approved } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Review Approved", type: "feature", status: "approved", author_name: "Test"
    }).select().single();
    const { data: open } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Review Open", type: "bug", status: "open", author_name: "Test"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Needs Review" }).click();
    await expect(page.getByText("E2E V2 Test Review Open")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E V2 Test Review Approved")).not.toBeVisible();

    if (approved) await supabase.from("feature_requests").delete().eq("id", approved.id);
    if (open) await supabase.from("feature_requests").delete().eq("id", open.id);
  });

  test("shows empty filter message when no items match @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test Empty%");
    const { data: feature } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test Empty Filter Feature", type: "feature", status: "open", author_name: "Test"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("E2E V2 Test Empty Filter Feature")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Bugs" }).click();
    await expect(page.getByText("No items match this filter.")).toBeVisible();

    if (feature) await supabase.from("feature_requests").delete().eq("id", feature.id);
  });
});

test.describe("Feature Board v2 - AI Verdict Filtering", () => {
  test("AI verdict approved shows in Approved filter tab @requires-migration-002", async ({ page }) => {
    if (await skipIfNoMigration()) return;

    await supabase.from("feature_requests").delete().like("title", "E2E V2 Test AI Filter%");
    const { data: approved } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test AI Filter Approved", type: "feature", status: "open", author_name: "Test",
      ai_verdict: "approved"
    }).select().single();
    const { data: rejected } = await supabase.from("feature_requests").insert({
      title: "E2E V2 Test AI Filter Rejected", type: "feature", status: "open", author_name: "Test",
      ai_verdict: "rejected"
    }).select().single();

    await page.goto("/features");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("E2E V2 Test AI Filter Approved")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("E2E V2 Test AI Filter Rejected")).toBeVisible();

    await page.getByRole("button", { name: "Approved" }).click();
    await expect(page.getByText("E2E V2 Test AI Filter Approved")).toBeVisible();
    await expect(page.getByText("E2E V2 Test AI Filter Rejected")).not.toBeVisible();

    if (approved) await supabase.from("feature_requests").delete().eq("id", approved.id);
    if (rejected) await supabase.from("feature_requests").delete().eq("id", rejected.id);
  });
});
