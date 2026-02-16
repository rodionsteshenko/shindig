import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers";

test.describe("Login Page", () => {
  test("renders login form with email input and submit button", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
    await expect(page.getByText("Enter your email to get a magic link")).toBeVisible();
    await expect(page.getByLabel(/Email address/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Send Magic Link/i })).toBeVisible();
  });

  test("shows logo link back to home", async ({ page }) => {
    await page.goto("/login");
    const logo = page.getByRole("link", { name: /Shindig/i }).first();
    await expect(logo).toHaveAttribute("href", "/");
  });

  test("redirects to dashboard if already logged in", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/login");

    // Should redirect to /dashboard
    await page.waitForURL("**/dashboard**");
  });

  test("shows validation for empty email", async ({ page }) => {
    await page.goto("/login");

    // HTML5 validation should prevent submission with empty email
    const emailInput = page.getByLabel(/Email address/i);
    await expect(emailInput).toHaveAttribute("required", "");
  });
});
