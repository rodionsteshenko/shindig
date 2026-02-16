import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("Create an Event link navigates to event creation", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Create an Event/i }).click();
    // Should navigate to /create (which redirects to /login for unauthenticated users)
    await page.waitForURL(/\/(create|login)/);
  });

  test("See a Demo link navigates to the demo event page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /See a Demo/i }).click();
    await expect(page).toHaveURL(/\/e\/demo/);
  });

  test("Feature board link navigates to feature requests", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /See the feature board/i }).click();
    await expect(page).toHaveURL(/\/features/);
    await expect(page.getByRole("heading", { name: /Feature Board/i })).toBeVisible();
  });

  test("footer Suggest a feature link navigates to feature board", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: /Suggest a feature/i }).click();
    await expect(page).toHaveURL(/\/features/);
  });
});
