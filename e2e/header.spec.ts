import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers";

test.describe("Header / Navigation", () => {
  test("shows logo linking to home", async ({ page }) => {
    await page.goto("/");
    const logo = page.locator("header").getByRole("link", { name: /Shindig/i });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute("href", "/");
  });

  test("shows Features link", async ({ page }) => {
    await page.goto("/");
    const featuresLink = page.locator("header").getByRole("link", { name: /Features/i });
    await expect(featuresLink).toBeVisible();
    await expect(featuresLink).toHaveAttribute("href", "/features");
  });

  test("shows Sign In button when logged out", async ({ page }) => {
    await page.goto("/");
    const signIn = page.locator("header").getByRole("link", { name: /Sign In/i });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute("href", "/login");
  });

  test("shows Dashboard, Create Event, and Sign Out when logged in", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/");

    const header = page.locator("header");
    await expect(header.getByRole("link", { name: /Dashboard/i })).toBeVisible();
    await expect(header.getByRole("link", { name: /Create Event/i })).toBeVisible();
    await expect(header.getByRole("button", { name: /Sign Out/i })).toBeVisible();

    // Sign In should NOT be visible when logged in
    await expect(header.getByRole("link", { name: /Sign In/i })).not.toBeVisible();
  });
});
