/**
 * Idle Improvement Finder
 *
 * When the pipeline has no queued features to implement, this script:
 *   1. Takes screenshots of the live app (production URL or localhost:3000)
 *   2. Scans the src/ codebase for structural improvement opportunities
 *   3. Checks recently completed improvements to avoid repeats
 *   4. Sends screenshots + code inventory to Claude (via Anthropic SDK) for visual analysis
 *   5. Creates a GitHub Issue labeled pipeline:queued + type:improvement
 *   6. Returns the issue + PRD JSON for immediate execution by Ralph
 *
 * Improvement categories: refactor/modularize, test coverage, UI/UX polish, TypeScript strictness
 *
 * Ralph (during implementation) also has Playwright MCP available via .mcp.json,
 * so it can take its own before/after screenshots to visually verify changes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { chromium } from "playwright";
import { execSync, spawnSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const ROOT = process.cwd();

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
}

export interface ImprovementResult {
  issue: GitHubIssue;
  prd: Record<string, unknown>;
}

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

/** Get Anthropic API key — from env or macOS keychain (where Claude Code stores it) */
function getAnthropicApiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;

  try {
    const key = execSync(
      "security find-generic-password -s anthropic -w 2>/dev/null",
      { encoding: "utf-8", shell: "/bin/bash" }
    ).trim();
    if (key) return key;
  } catch { /* not in keychain */ }

  throw new Error(
    "ANTHROPIC_API_KEY not set and not found in macOS keychain. " +
    "Add it to .env.local or run: security add-generic-password -s anthropic -a api-key -w <your-key>"
  );
}

/** Determine the base URL to screenshot */
function getAppUrl(): string {
  // Prefer explicit env var
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");

  // Check if local dev server is running on 3000
  try {
    const result = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "2", "http://localhost:3000"], {
      encoding: "utf-8",
    });
    if (result.stdout.trim().startsWith("2") || result.stdout.trim().startsWith("3")) {
      return "http://localhost:3000";
    }
  } catch { /* not running */ }

  return "";
}

interface Screenshot {
  page: string;
  path: string;
  base64: string;
}

/** Take screenshots of key pages using Playwright */
async function takeScreenshots(baseUrl: string): Promise<Screenshot[]> {
  const screenshotDir = join(ROOT, ".ralph", "screenshots");
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });

  const pages = [
    { name: "landing", path: "/" },
    { name: "create", path: "/create" },
    { name: "features", path: "/features" },
    { name: "login", path: "/login" },
  ];

  const screenshots: Screenshot[] = [];
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });

    for (const p of pages) {
      const url = `${baseUrl}${p.path}`;
      const filePath = join(screenshotDir, `${p.name}.png`);

      try {
        const browserPage = await context.newPage();
        await browserPage.goto(url, { waitUntil: "networkidle", timeout: 10000 });
        await browserPage.screenshot({ path: filePath, fullPage: false });
        await browserPage.close();

        const { readFileSync } = await import("fs");
        const base64 = readFileSync(filePath).toString("base64");
        screenshots.push({ page: p.path, path: filePath, base64 });
        log(`Screenshot: ${url}`);
      } catch (err) {
        log(`Screenshot failed for ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    await browser.close();
  }

  return screenshots;
}

/** Get all TypeScript/TSX files in src/ with their line counts */
function getCodebaseInventory(): string {
  try {
    const result = spawnSync("bash", [
      "-c",
      `find ${ROOT}/src -name "*.ts" -o -name "*.tsx" | while read f; do wc -l < "$f" | tr -d ' ' | xargs -I{} echo "{} $f"; done | sort -rn | head -40`,
    ], { encoding: "utf-8" });

    return result.stdout.trim() || "No files found";
  } catch {
    return "Could not scan codebase";
  }
}

/** Fetch recently closed type:improvement issues to avoid repeats */
function getRecentImprovements(): string[] {
  const result = spawnSync("gh", [
    "issue", "list",
    "--label", "type:improvement",
    "--state", "closed",
    "--json", "title",
    "--limit", "20",
  ], {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) return [];

  try {
    const issues = JSON.parse(result.stdout.trim() || "[]") as { title: string }[];
    return issues.map((i) => i.title);
  } catch {
    return [];
  }
}

/** Ask Claude (via SDK) for the best improvement — with or without screenshots */
async function askClaudeForImprovement(
  inventory: string,
  recentImprovements: string[],
  screenshots: Screenshot[]
): Promise<{ title: string; prd: Record<string, unknown> } | null> {
  const apiKey = getAnthropicApiKey();
  const client = new Anthropic({ apiKey });

  const recentList = recentImprovements.length > 0
    ? recentImprovements.map((t) => `- ${t}`).join("\n")
    : "None yet";

  const hasScreenshots = screenshots.length > 0;

  const textPrompt = `You are a senior engineer analyzing the Shindig codebase to find the most valuable improvement to make autonomously.

Shindig is an event planning web app built with:
- Next.js 15 (App Router), React 19, TypeScript (strict mode)
- Tailwind CSS 3.4 (utility classes only)
- Supabase (Postgres, auth, realtime)
- Resend for email (React Email templates)

## Codebase file inventory (lines, path) — largest files first:
${inventory}

## Recently completed improvements (do NOT repeat these):
${recentList}

${hasScreenshots ? `## Visual context
I've attached ${screenshots.length} screenshot(s) of the live app (pages: ${screenshots.map(s => s.page).join(", ")}).
Use these to identify real visual/UX issues you can see directly.
` : "## Note: No live app screenshots available — base your analysis on code structure only.\n"}

## Your task:
Pick ONE specific, actionable improvement from these categories:
1. **Refactor / modularize** — break up a large file, extract a reusable component or utility
2. **Test coverage** — add meaningful E2E tests for an area that has poor or no coverage
3. **UI / UX polish** — fix a real visual/layout/accessibility issue you can see in the screenshots (if available)
4. **TypeScript strictness** — remove 'any' types, add missing return types, improve type safety

Rules:
- Be SPECIFIC: name the exact file(s) and the exact change
- Must be completable in ONE Ralph session (1-3 user stories max)
- Must NOT duplicate any recently completed improvement above
- If screenshots are provided, prioritize issues you can actually SEE
- Do NOT suggest adding new features — only improvements to existing code

IMPORTANT: The implementation agent (Ralph) has Playwright MCP available. For UI improvements,
include an acceptance criterion like: "Visually verify the fix using the Playwright browser tool on localhost:3000"

Return ONLY a valid JSON object (no markdown fences, no explanation) with this structure:
{
  "title": "Short imperative title for the GitHub Issue (max 80 chars)",
  "project": "Shindig",
  "description": "One sentence describing what this improvement does and why",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title in imperative form",
      "description": "As a developer, I want [goal] so that [benefit]",
      "acceptanceCriteria": [
        "Specific criterion 1",
        "Specific criterion 2",
        "TypeScript strict-mode typecheck passes",
        "Visually verify the change looks correct using the Playwright browser tool on localhost:3000"
      ],
      "priority": 1,
      "status": "incomplete",
      "phase": 1
    }
  ]
}`;

  // Build message content — text + optional images
  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/png"; data: string } };

  const content: ContentBlock[] = [];

  if (hasScreenshots) {
    for (const s of screenshots) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: s.base64 },
      });
    }
  }

  content.push({ type: "text", text: textPrompt });

  let result: string;
  try {
    const message = await client.messages.create({
      model: "claude-opus-4-5-20251101",
      max_tokens: 2048,
      messages: [{ role: "user", content }],
    });

    result = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (err) {
    log(`Anthropic API call failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }

  // Strip markdown fences if present
  let cleaned = result.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let prd: Record<string, unknown>;
  try {
    prd = JSON.parse(cleaned);
  } catch {
    log(`Failed to parse improvement PRD JSON`);
    log(`Raw output: ${result.substring(0, 300)}`);
    return null;
  }

  const title = (prd.title as string) || "Codebase improvement";
  delete prd.title; // title goes on the GitHub issue, not in the PRD body

  return { title, prd };
}

/** Create a GitHub Issue and return it */
function createImprovementIssue(
  title: string,
  prd: Record<string, unknown>,
  hasScreenshots: boolean
): GitHubIssue | null {
  const body = `## Autonomous Improvement

This task was generated by the Shindig idle improvement pipeline.
${hasScreenshots ? "\n> Visual analysis performed using live app screenshots.\n" : ""}
${prd.description || ""}

## PRD

<details><summary>Ralph PRD JSON</summary>

\`\`\`json
${JSON.stringify(prd, null, 2)}
\`\`\`

</details>`;

  const bodyFile = join(tmpdir(), `shindig-improvement-body-${Date.now()}.md`);
  writeFileSync(bodyFile, body);

  try {
    const result = spawnSync("gh", [
      "issue", "create",
      "--title", title,
      "--body-file", bodyFile,
      "--label", "pipeline:queued,type:improvement",
    ], {
      encoding: "utf-8",
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status !== 0) {
      log(`Failed to create GitHub Issue: ${result.stderr}`);
      return null;
    }

    // gh issue create outputs the URL — extract the issue number
    const url = result.stdout.trim();
    const match = url.match(/\/issues\/(\d+)$/);
    if (!match) {
      log(`Could not parse issue number from URL: ${url}`);
      return null;
    }

    const issueNumber = parseInt(match[1], 10);
    log(`Created improvement issue #${issueNumber}: "${title}"`);
    return { number: issueNumber, title, body };
  } finally {
    try { unlinkSync(bodyFile); } catch { /* ignore */ }
  }
}

/** Main export: find an improvement, optionally with visual analysis */
export async function findImprovement(): Promise<ImprovementResult | null> {
  log("Scanning codebase for improvement opportunities...");
  const inventory = getCodebaseInventory();

  log("Checking recently completed improvements...");
  const recentImprovements = getRecentImprovements();
  if (recentImprovements.length > 0) {
    log(`${recentImprovements.length} recent improvements found — will avoid repeating`);
  }

  // Try to take screenshots of the live app
  let screenshots: Screenshot[] = [];
  const appUrl = getAppUrl();

  if (appUrl) {
    log(`Taking screenshots of ${appUrl}...`);
    try {
      screenshots = await takeScreenshots(appUrl);
      log(`Captured ${screenshots.length} screenshot(s)`);
    } catch (err) {
      log(`Screenshot step failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    log("No live app URL found (set APP_URL in .env.local, or start dev server on :3000) — using code analysis only");
  }

  log("Asking Claude to identify best improvement...");
  const result = await askClaudeForImprovement(inventory, recentImprovements, screenshots);
  if (!result) return null;

  const issue = createImprovementIssue(result.title, result.prd, screenshots.length > 0);
  if (!issue) return null;

  return { issue, prd: result.prd };
}

// Allow running standalone for testing
if (require.main === module) {
  findImprovement().then((result) => {
    if (result) {
      console.log(`\nImprovement ready: #${result.issue.number} "${result.issue.title}"`);
    } else {
      console.log("Could not identify an improvement task");
      process.exit(1);
    }
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
