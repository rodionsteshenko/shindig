import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers";

test.describe("Header Navigation", () => {
  test("logged-out user can navigate to login via Sign In", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("logged-out user can navigate to features from header", async ({ page }) => {
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: /Features/i }).click();
    await expect(page).toHaveURL(/\/features/);
  });

  test("logged-in user sees Dashboard, Create Event, and Sign Out instead of Sign In", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/");

    const header = page.locator("header");
    // Auth links should be present
    await expect(header.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /Create Event/i })).toBeVisible();
    await expect(header.getByRole("button", { name: /Sign Out/i })).toBeVisible();
    // Sign In should be gone
    await expect(header.getByRole("link", { name: /Sign In/i })).not.toBeVisible();
  });

  test("logged-in user can navigate to dashboard from header", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/");
    await page.locator("header").getByRole("link", { name: /Dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("logo navigates back to home from any page", async ({ page }) => {
    await page.goto("/features");
    await page.locator("header").getByRole("link", { name: /Shindig/i }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
