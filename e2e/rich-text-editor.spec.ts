import { test, expect } from "@playwright/test";

test.describe("RichTextEditor Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/test-rich-text");
    // Wait for the editor to be fully loaded
    await page.waitForSelector('[data-testid="html-output"]');
  });

  test("renders with initial content", async ({ page }) => {
    // Check that the editor displays the initial content
    const output = page.getByTestId("html-output");
    await expect(output).toContainText("Initial content");
  });

  test("can type text in the editor", async ({ page }) => {
    // Find the editable area and type
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Hello world");

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("Hello world");
  });

  test("can apply bold formatting", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Bold text");

    // Triple-click to select all text in the paragraph
    await editor.click({ clickCount: 3 });

    // Click bold button
    await page.getByRole("button", { name: /toggle bold/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<strong>");
    await expect(output).toContainText("Bold text");
  });

  test("can apply italic formatting", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Italic text");

    // Triple-click to select all text in the paragraph
    await editor.click({ clickCount: 3 });

    // Click italic button
    await page.getByRole("button", { name: /toggle italic/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<em>");
    await expect(output).toContainText("Italic text");
  });

  test("can add heading 2", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("My Heading");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click H2 button
    await page.getByRole("button", { name: /toggle heading 2/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<h2>");
    await expect(output).toContainText("My Heading");
  });

  test("can add heading 3", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("My Subheading");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click H3 button
    await page.getByRole("button", { name: /toggle heading 3/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<h3>");
    await expect(output).toContainText("My Subheading");
  });

  test("can create bullet list", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("First item");

    // Click bullet list button
    await page.getByRole("button", { name: /toggle bullet list/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<ul>");
    await expect(output).toContainText("<li>");
    await expect(output).toContainText("First item");
  });

  test("can create numbered list", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("First item");

    // Click ordered list button
    await page.getByRole("button", { name: /toggle numbered list/i }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<ol>");
    await expect(output).toContainText("<li>");
    await expect(output).toContainText("First item");
  });

  test("can add a link", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Click here");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click link button
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Enter URL in the input that appears
    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();
    await linkInput.fill("https://example.com");

    // Click Add button
    await page.getByRole("button", { name: "Add" }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText('href="https://example.com"');
    await expect(output).toContainText("Click here");
  });

  test("auto-prepends https:// to links without protocol", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Visit site");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click link button
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Enter URL without protocol
    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();
    await linkInput.fill("example.com");

    // Click Add button
    await page.getByRole("button", { name: "Add" }).click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText('href="https://example.com"');
  });

  test("can remove a link", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Click here");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });
    await page.getByRole("button", { name: /toggle link/i }).click();

    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();
    await linkInput.fill("https://example.com");
    await page.getByRole("button", { name: "Add" }).click();

    // Verify link was added
    let output = page.getByTestId("html-output");
    await expect(output).toContainText('href="https://example.com"');

    // Triple-click to select text again and click link button to remove
    await editor.click({ clickCount: 3 });
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Link should be removed
    output = page.getByTestId("html-output");
    await expect(output).not.toContainText("href");
    await expect(output).toContainText("Click here");
  });

  test("toolbar buttons show active state when cursor is inside formatted text", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Bold text");

    // Triple-click to select all and make bold
    await editor.click({ clickCount: 3 });
    await page.getByRole("button", { name: /toggle bold/i }).click();

    // Verify bold was applied
    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<strong>");

    // Click inside the bold text - the button should show active
    const boldText = editor.locator("strong");
    await boldText.click();

    // Bold button should have the active class
    const boldButton = page.getByRole("button", { name: /toggle bold/i });
    await expect(boldButton).toHaveClass(/bg-shindig-100/);
  });

  test("clear button clears the editor content", async ({ page }) => {
    // Click clear button
    await page.getByTestId("clear-button").click();

    const output = page.getByTestId("html-output");
    // Empty editor might show empty string or minimal HTML
    const outputText = await output.textContent();
    expect(outputText?.replace(/<[^>]*>/g, "").trim()).toBe("");
  });

  test("reset button resets the editor content", async ({ page }) => {
    // First clear the content
    await page.getByTestId("clear-button").click();

    // Then reset
    await page.getByTestId("reset-button").click();

    const output = page.getByTestId("html-output");
    await expect(output).toContainText("Reset to default content");
  });

  test("can cancel link input with Cancel button", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Some text");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click link button
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Link input should appear
    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();

    // Click cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Link input should disappear
    await expect(linkInput).not.toBeVisible();

    // No link should be added
    const output = page.getByTestId("html-output");
    await expect(output).not.toContainText("href");
  });

  test("can cancel link input with Escape key", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Some text");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click link button
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Link input should appear
    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Link input should disappear
    await expect(linkInput).not.toBeVisible();
  });

  test("can submit link with Enter key", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Click me");

    // Triple-click to select all text
    await editor.click({ clickCount: 3 });

    // Click link button
    await page.getByRole("button", { name: /toggle link/i }).click();

    // Enter URL and press Enter
    const linkInput = page.locator('input[type="url"]');
    await expect(linkInput).toBeVisible();
    await linkInput.fill("https://test.com");
    await page.keyboard.press("Enter");

    const output = page.getByTestId("html-output");
    await expect(output).toContainText('href="https://test.com"');
  });

  test("toolbar has all required buttons", async ({ page }) => {
    // Verify all formatting buttons are present
    await expect(page.getByRole("button", { name: /toggle bold/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle italic/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle heading 2/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle heading 3/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle bullet list/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle numbered list/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /toggle link/i })).toBeVisible();
  });

  test("rendered preview shows formatted content correctly", async ({ page }) => {
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await editor.clear();
    await page.keyboard.type("Important");

    // Triple-click to select all and make bold
    await editor.click({ clickCount: 3 });
    await page.getByRole("button", { name: /toggle bold/i }).click();

    // Verify bold was applied in HTML output first
    const output = page.getByTestId("html-output");
    await expect(output).toContainText("<strong>");

    // Check the rendered preview
    const preview = page.getByTestId("rendered-preview");
    const boldText = preview.locator("strong");
    await expect(boldText).toContainText("Important");
  });
});
