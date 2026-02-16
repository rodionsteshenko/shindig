import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

test.afterAll(async () => {
  // Clean up test feature requests
  await supabase
    .from("feature_requests")
    .delete()
    .like("title", "E2E Test%");
});

test.describe("Feature Board", () => {
  test("renders feature board page", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("heading", { name: "Feature Board" })).toBeVisible();
    await expect(page.getByText("Suggest features and vote")).toBeVisible();
  });

  test("shows feature form with type selector", async ({ page }) => {
    await page.goto("/features");
    await expect(page.getByRole("heading", { name: "Suggest a Feature" })).toBeVisible();
    await expect(page.getByPlaceholder("Feature title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the feature (optional)")).toBeVisible();
    await expect(page.getByPlaceholder("Your name (optional)")).toBeVisible();
    // Type selector radio buttons
    await expect(page.getByLabel("Feature Request")).toBeVisible();
    await expect(page.getByLabel("Bug Report")).toBeVisible();
  });

  test("can submit a feature request", async ({ page }) => {
    await page.goto("/features");

    // Ensure Feature Request radio is selected by default
    await expect(page.getByLabel("Feature Request")).toBeChecked();

    await page.getByPlaceholder("Feature title *").fill("E2E Test Feature Request");
    await page.getByPlaceholder("Describe the feature (optional)").fill("This is a test feature");
    await page.getByPlaceholder("Your name (optional)").fill("Test User");
    await page.getByRole("button", { name: "Submit" }).click();

    // After submit, the feature should appear in the list
    await expect(page.getByText("E2E Test Feature Request")).toBeVisible({ timeout: 5000 });
  });

  test("can submit a bug report", async ({ page }) => {
    await page.goto("/features");

    // Select Bug Report
    await page.getByLabel("Bug Report").click();
    await expect(page.getByRole("heading", { name: "Report a Bug" })).toBeVisible();
    await expect(page.getByPlaceholder("Bug title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the bug and steps to reproduce (optional)")).toBeVisible();

    await page.getByPlaceholder("Bug title *").fill("E2E Test Bug Report");
    await page.getByPlaceholder("Describe the bug and steps to reproduce (optional)").fill("Steps to reproduce the bug");
    await page.getByRole("button", { name: "Submit" }).click();

    // After submit, the bug report should appear in the list
    await expect(page.getByText("E2E Test Bug Report")).toBeVisible({ timeout: 5000 });
  });

  test("type selector toggles between feature and bug placeholders", async ({ page }) => {
    await page.goto("/features");

    // Default is Feature Request
    await expect(page.getByPlaceholder("Feature title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the feature (optional)")).toBeVisible();

    // Switch to Bug Report
    await page.getByLabel("Bug Report").click();
    await expect(page.getByPlaceholder("Bug title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the bug and steps to reproduce (optional)")).toBeVisible();

    // Switch back to Feature Request
    await page.getByLabel("Feature Request").click();
    await expect(page.getByPlaceholder("Feature title *")).toBeVisible();
    await expect(page.getByPlaceholder("Describe the feature (optional)")).toBeVisible();
  });

  test("shows empty state when no features", async ({ page }) => {
    // Clean all test features first
    await supabase.from("feature_requests").delete().like("title", "E2E Test%");
    await supabase.from("feature_requests").delete().neq("title", "");

    await page.goto("/features");
    await expect(
      page.getByText("No feature requests yet")
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Feature API", () => {
  test("GET /api/features returns list", async ({ request }) => {
    const response = await request.get("/api/features");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test("POST /api/features creates a feature request", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        title: "E2E Test API Feature",
        description: "Created via API test",
        author_name: "API Tester",
        type: "feature",
      },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.title).toBe("E2E Test API Feature");
    expect(data.type).toBe("feature");
    expect(data.vote_count).toBe(0);
  });

  test("POST /api/features creates a bug report", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        title: "E2E Test API Bug",
        description: "Created via API test",
        author_name: "API Tester",
        type: "bug",
      },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.title).toBe("E2E Test API Bug");
    expect(data.type).toBe("bug");
  });

  test("POST /api/features defaults to feature type if not provided", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        title: "E2E Test API No Type",
        description: "Created via API test without explicit type",
      },
    });
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.type).toBe("feature");
  });

  test("POST /api/features requires title", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: { description: "No title" },
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/features/[id]/vote toggles votes", async ({ request }) => {
    // Create a feature to vote on
    const createRes = await request.post("/api/features", {
      data: { title: "E2E Test Votable Feature", type: "feature" },
    });
    const feature = await createRes.json();

    // Vote
    const voteRes = await request.post(`/api/features/${feature.id}/vote`, {
      data: { voter_identifier: "test-voter-e2e" },
    });
    expect(voteRes.ok()).toBeTruthy();
    const voteData = await voteRes.json();
    expect(voteData.voted).toBe(true);

    // Un-vote (toggle)
    const unvoteRes = await request.post(`/api/features/${feature.id}/vote`, {
      data: { voter_identifier: "test-voter-e2e" },
    });
    expect(unvoteRes.ok()).toBeTruthy();
    const unvoteData = await unvoteRes.json();
    expect(unvoteData.voted).toBe(false);
  });
});
