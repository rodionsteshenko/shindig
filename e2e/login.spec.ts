import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./helpers";

test.describe("Login Page", () => {
  test("already logged-in user gets redirected to dashboard", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/login");
    await page.waitForURL("**/dashboard**");
  });

  test("unauthenticated user trying to create event gets redirected to login", async ({ page }) => {
    await page.goto("/create");
    await page.waitForURL("**/login**");
  });

  test("login page has working link back to home", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /Shindig/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
