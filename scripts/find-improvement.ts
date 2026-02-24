/**
 * Idle Improvement Finder
 *
 * When the pipeline has no queued features to implement, this script:
 *   1. Scans the src/ codebase for improvement opportunities (file sizes, structure)
 *   2. Checks recently completed improvements to avoid repeats
 *   3. Asks Claude to pick the most valuable improvement task
 *   4. Creates a GitHub Issue labeled pipeline:queued + type:improvement
 *   5. Returns the issue + PRD JSON for immediate execution
 *
 * Improvement categories: refactor/modularize, test coverage, UI/UX polish, TypeScript strictness
 */

import { execSync, spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const ROOT = process.cwd();

// Clean env without CLAUDECODE so nested claude calls work
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDECODE;

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

/** Ask Claude to identify the best improvement and return a PRD JSON */
function askClaudeForImprovement(
  inventory: string,
  recentImprovements: string[]
): { title: string; prd: Record<string, unknown> } | null {
  const recentList = recentImprovements.length > 0
    ? recentImprovements.map((t) => `- ${t}`).join("\n")
    : "None yet";

  const prompt = `You are a senior engineer analyzing the Shindig codebase to find the most valuable improvement to make autonomously.

Shindig is an event planning web app built with:
- Next.js 15 (App Router), React 19, TypeScript (strict mode)
- Tailwind CSS 3.4 (utility classes only)
- Supabase (Postgres, auth, realtime)
- Resend for email (React Email templates)

## Codebase file inventory (lines, path) — largest files first:
${inventory}

## Recently completed improvements (do NOT repeat these):
${recentList}

## Your task:
Pick ONE specific, actionable improvement from these categories:
1. **Refactor / modularize** — break up a large file, extract a reusable component or utility
2. **Test coverage** — add meaningful E2E tests for an area that has poor or no coverage
3. **UI / UX polish** — small but impactful visual/accessibility/responsiveness improvement
4. **TypeScript strictness** — remove 'any' types, add missing return types, improve type safety

Rules:
- Be SPECIFIC: name the exact file(s), the exact change
- Must be completable in ONE Ralph session (1-3 user stories max)
- Must NOT duplicate any recently completed improvement above
- Prefer improvements with the highest impact-to-effort ratio
- Do NOT suggest adding features — only improvements to existing code

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
      "acceptanceCriteria": ["Specific criterion 1", "Specific criterion 2", "TypeScript strict-mode typecheck passes"],
      "priority": 1,
      "status": "incomplete",
      "phase": 1
    }
  ]
}`;

  const promptFile = join(tmpdir(), `shindig-improvement-${Date.now()}.txt`);
  writeFileSync(promptFile, prompt);

  let result: string;
  try {
    result = execSync(
      `cat "${promptFile}" | claude --print --dangerously-skip-permissions`,
      {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        env: cleanEnv,
        shell: "/bin/bash",
      }
    ).trim();
  } catch (err) {
    log(`Claude CLI failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    try { unlinkSync(promptFile); } catch { /* ignore */ }
  }

  // Strip markdown fences if present
  let cleaned = result;
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
  delete prd.title; // title goes to the issue, not the PRD

  return { title, prd };
}

/** Create a GitHub Issue for the improvement and return it */
function createImprovementIssue(
  title: string,
  prd: Record<string, unknown>
): GitHubIssue | null {
  const body = `## Autonomous Improvement

This task was generated by the Shindig idle improvement pipeline.

**Category:** ${detectCategory(prd)}

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

function detectCategory(prd: Record<string, unknown>): string {
  const desc = String(prd.description || "").toLowerCase();
  if (desc.includes("refactor") || desc.includes("extract") || desc.includes("modular")) return "Refactor / modularize";
  if (desc.includes("test") || desc.includes("coverage") || desc.includes("spec")) return "Test coverage";
  if (desc.includes("type") || desc.includes("any") || desc.includes("strict")) return "TypeScript strictness";
  return "UI / UX polish";
}

/** Main export: find an improvement and create a GitHub Issue for it */
export async function findImprovement(): Promise<ImprovementResult | null> {
  log("Scanning codebase for improvement opportunities...");
  const inventory = getCodebaseInventory();

  log("Checking recently completed improvements...");
  const recentImprovements = getRecentImprovements();
  if (recentImprovements.length > 0) {
    log(`Found ${recentImprovements.length} recently completed improvements to avoid repeating`);
  }

  log("Asking Claude to identify best improvement...");
  const result = askClaudeForImprovement(inventory, recentImprovements);
  if (!result) return null;

  const issue = createImprovementIssue(result.title, result.prd);
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
  });
}
