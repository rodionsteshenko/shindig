import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders hero section with title and CTA buttons", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Shindig/i })).toBeVisible();
    await expect(page.getByText("Event invites that don't suck")).toBeVisible();

    const createLink = page.getByRole("link", { name: /Create an Event/i });
    await expect(createLink).toBeVisible();
    await expect(createLink).toHaveAttribute("href", "/create");

    const demoLink = page.getByRole("link", { name: /See a Demo/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute("href", "/e/demo");
  });

  test("shows 'How it works' section with 3 steps", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("Create", { exact: true })).toBeVisible();
    await expect(page.getByText("Invite", { exact: true })).toBeVisible();
    await expect(page.getByText("Track", { exact: true })).toBeVisible();
  });

  test("shows feature request CTA section", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("This app gets better because of you")).toBeVisible();
    const featureLink = page.getByRole("link", { name: /See the feature board/i });
    await expect(featureLink).toBeVisible();
    await expect(featureLink).toHaveAttribute("href", "/features");
  });

  test("shows pricing section with 3 tiers", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Pricing")).toBeVisible();
    await expect(page.getByText("Free", { exact: true })).toBeVisible();
    await expect(page.getByText("Pro", { exact: true })).toBeVisible();
    await expect(page.getByText("Event Pass", { exact: true })).toBeVisible();
  });

  test("shows footer with suggest feature link", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: /Suggest a feature/i })).toHaveAttribute(
      "href",
      "/features"
    );
  });
});
