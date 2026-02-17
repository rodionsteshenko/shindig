/**
 * Feature Pipeline Orchestrator
 *
 * Runs the full feature processing pipeline:
 *   1. Judge open features (Claude evaluates submissions)
 *   2. Generate PRDs for approved features (creates GitHub Issues)
 *   3. Pick up or continue a feature for Ralph to implement
 *
 * Implementation tracking uses GitHub Issues with pipeline:* labels.
 * Supabase still stores user submissions, votes, and AI verdicts.
 *
 * Designed to be run repeatedly (e.g. via launchd cron). Each invocation
 * fully implements one feature via `ralph execute`, completing all user
 * stories in its PRD before exiting.
 *
 * Run: npx tsx --env-file=.env.local scripts/pipeline.ts
 */

import { createClient } from "@supabase/supabase-js";
import { execSync, spawnSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

const ROOT = resolve(__dirname, "..");
const PRD_PATH = resolve(ROOT, ".ralph", "prd.json");
const LOCK_PATH = resolve(ROOT, ".ralph", "pipeline.lock");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Clean env without CLAUDECODE so nested claude/ralph calls work
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDECODE;

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
}

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function runScript(name: string) {
  execSync(`npx tsx --env-file=.env.local scripts/${name}`, {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "inherit",
    maxBuffer: 1024 * 1024,
    env: cleanEnv,
  });
}

/** Query GitHub Issues by label using gh CLI */
function ghIssueList(label: string, limit = 1): GitHubIssue[] {
  const result = spawnSync("gh", [
    "issue", "list",
    "--label", label,
    "--json", "number,title,body",
    "--limit", String(limit),
    "--search", "sort:reactions-+1-desc",
  ], {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    log(`gh issue list failed: ${result.stderr}`);
    return [];
  }

  try {
    return JSON.parse(result.stdout.trim() || "[]");
  } catch {
    return [];
  }
}

/** Update labels on a GitHub Issue */
function ghIssueEditLabels(issueNumber: number, addLabels: string[], removeLabels: string[]) {
  const args = ["issue", "edit", String(issueNumber)];
  for (const l of addLabels) {
    args.push("--add-label", l);
  }
  for (const l of removeLabels) {
    args.push("--remove-label", l);
  }
  spawnSync("gh", args, {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Close a GitHub Issue */
function ghIssueClose(issueNumber: number) {
  spawnSync("gh", ["issue", "close", String(issueNumber)], {
    encoding: "utf-8",
    cwd: ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/** Parse PRD JSON from the details block in an issue body */
function parsePrdFromBody(body: string): Record<string, unknown> | null {
  const match = body.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/** Generate a PRD for an issue that has no embedded PRD JSON */
function generatePrdForIssue(issue: GitHubIssue): Record<string, unknown> | null {
  log(`Generating PRD inline for issue #${issue.number} "${issue.title}"...`);

  const prompt = `You are a product manager generating a PRD for a development agent called Ralph.

Generate a PRD JSON object for the following feature for Shindig, an event planning web app built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Supabase.

Feature: ${issue.title}

Return ONLY a valid JSON object (no markdown fences) with this exact structure:
{
  "project": "Shindig",
  "description": "Brief description of what this PRD covers",
  "userStories": [
    {
      "id": "US-001",
      "title": "Story title in imperative form",
      "description": "As a [role], I want [goal] so that [benefit]",
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "priority": 1,
      "status": "incomplete",
      "phase": 1
    }
  ]
}

Guidelines:
- Break the feature into 1-4 user stories depending on complexity
- Each story should be independently implementable
- Acceptance criteria should be specific and testable
- Include criteria for TypeScript typecheck passing
- Include E2E test criteria where appropriate
- Reference existing file paths and patterns from the Shindig codebase (src/app/ for routes, src/components/ for UI, src/lib/ for utilities)`;

  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, "\\n");

  let result: string;
  try {
    result = execSync(
      `claude --print --dangerously-skip-permissions -p "${escapedPrompt}"`,
      {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        env: cleanEnv,
      }
    ).trim();
  } catch (err) {
    log(`Claude CLI failed for issue #${issue.number}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
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
    log(`Failed to parse generated PRD JSON for issue #${issue.number}`);
    return null;
  }

  // Write PRD back to the issue body
  const prdBody = `${issue.body.trim()}

## PRD

<details><summary>Ralph PRD JSON</summary>

\`\`\`json
${JSON.stringify(prd, null, 2)}
\`\`\`

</details>`;

  const bodyFile = join(tmpdir(), `shindig-prd-${issue.number}-${Date.now()}.md`);
  try {
    writeFileSync(bodyFile, prdBody);
    const editResult = spawnSync("gh", [
      "issue", "edit", String(issue.number),
      "--body-file", bodyFile,
    ], {
      encoding: "utf-8",
      cwd: ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (editResult.status !== 0) {
      log(`Failed to update issue #${issue.number} body: ${editResult.stderr}`);
    } else {
      log(`PRD written back to issue #${issue.number}`);
    }
  } finally {
    try { unlinkSync(bodyFile); } catch { /* ignore */ }
  }

  return prd;
}

/** Ensure .ralph/prd.json has the metadata/phases/branchName Ralph requires */
function ensurePrdMetadata() {
  if (!existsSync(PRD_PATH)) return;

  try {
    const prd = JSON.parse(readFileSync(PRD_PATH, "utf-8"));
    let dirty = false;
    const stories: unknown[] = prd.userStories ?? [];
    const now = new Date().toISOString();

    if (!prd.metadata) {
      const completed = stories.filter(
        (s) => (s as { status: string }).status === "complete"
      ).length;
      prd.metadata = {
        createdAt: now,
        lastUpdatedAt: now,
        totalStories: stories.length,
        completedStories: completed,
        currentIteration: 1,
      };
      dirty = true;
    }
    if (!prd.phases) {
      prd.phases = { "1": { name: "Phase 1", description: "" } };
      dirty = true;
    }
    if (!prd.branchName) {
      prd.branchName = "main";
      dirty = true;
    }
    if (dirty) {
      writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2));
    }
  } catch {
    // ignore parse errors
  }
}

/** Run tests and push to remote if they pass */
function testAndPush() {
  log("Running tests before push...");
  const testResult = spawnSync("npm", ["test"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "inherit",
    env: cleanEnv,
    timeout: 5 * 60 * 1000, // 5 minute timeout
  });

  if (testResult.status !== 0) {
    log("Tests failed — skipping push to remote");
    return false;
  }

  log("Tests passed — pushing to remote...");
  const pushResult = spawnSync("git", ["push", "origin", "main"], {
    cwd: ROOT,
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (pushResult.status !== 0) {
    log("Git push failed — will retry on next pipeline run");
    return false;
  }

  log("Pushed to origin/main — Vercel will auto-deploy");
  return true;
}

/** Check if the current .ralph/prd.json has any remaining stories */
function prdIsComplete(): boolean {
  if (!existsSync(PRD_PATH)) return true;

  try {
    const prd = JSON.parse(readFileSync(PRD_PATH, "utf-8"));
    const stories: { status: string }[] = prd.userStories ?? [];
    return stories.every(
      (s) => s.status === "complete" || s.status === "skipped"
    );
  } catch {
    return true; // can't parse → treat as complete so we move on
  }
}

function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    // Check if the lock is stale (older than 2 hours)
    const lockAge = Date.now() - new Date(readFileSync(LOCK_PATH, "utf-8")).getTime();
    if (lockAge < 2 * 60 * 60 * 1000) {
      return false;
    }
    log("Stale lock detected (>2h) — removing");
  }
  const ralphDir = resolve(ROOT, ".ralph");
  if (!existsSync(ralphDir)) mkdirSync(ralphDir, { recursive: true });
  writeFileSync(LOCK_PATH, new Date().toISOString());
  return true;
}

function releaseLock() {
  if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
}

/** Update Supabase implementation_status for backward compatibility */
async function updateSupabaseStatus(issueNumber: number, status: string) {
  // Find the feature by its GitHub issue number stored in prd_json
  const { data } = await supabase
    .from("feature_requests")
    .select("id, prd_json")
    .eq("implementation_status", status === "completed" ? "in_progress" : "queued")
    .not("prd_json", "is", null);

  if (!data) return;

  for (const row of data) {
    const prd = row.prd_json as Record<string, unknown>;
    if (prd.githubIssueNumber === issueNumber) {
      await supabase
        .from("feature_requests")
        .update({ implementation_status: status })
        .eq("id", row.id);
      return;
    }
  }
}

async function pipeline() {
  if (!acquireLock()) {
    log("Pipeline already running — skipping");
    return;
  }

  try {
    await runPipeline();
  } finally {
    releaseLock();
  }
}

async function runPipeline() {
  log("=== Shindig Feature Pipeline ===");

  // Step 1: Judge open features
  log("Step 1: Judging open features...");
  try {
    runScript("judge-features.ts");
  } catch (err) {
    log(`Judge step failed: ${err instanceof Error ? err.message : String(err)}`);
    // Non-fatal — continue with whatever is already approved
  }

  // Step 2: Generate PRDs for approved features (also creates GitHub Issues)
  log("Step 2: Generating PRDs for approved features...");
  try {
    runScript("generate-prd.ts");
  } catch (err) {
    log(`PRD generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Check if there's a feature currently in progress (via GitHub Issues)
  log("Step 3: Checking for in-progress features...");

  const inProgressIssues = ghIssueList("pipeline:in-progress", 1);

  if (inProgressIssues.length > 0) {
    const issue = inProgressIssues[0];

    if (prdIsComplete()) {
      log(`Completed: "${issue.title}" (#${issue.number}) — marking as done`);
      testAndPush();
      ghIssueEditLabels(issue.number, ["pipeline:completed"], ["pipeline:in-progress"]);
      ghIssueClose(issue.number);
      await updateSupabaseStatus(issue.number, "completed");
    } else {
      log(`Continuing: "${issue.title}" (#${issue.number})`);
      ensurePrdMetadata();
      execSync("ralph execute", { cwd: ROOT, stdio: "inherit", env: cleanEnv });
      testAndPush();
      log("=== Pipeline run complete ===");
      return;
    }
  }

  // Step 4: Pick the next queued feature (via GitHub Issues)
  log("Step 4: Picking next queued feature...");

  const queuedIssues = ghIssueList("pipeline:queued", 1);

  if (queuedIssues.length === 0) {
    log("No queued features — nothing to implement.");
    log("=== Pipeline run complete ===");
    return;
  }

  const next = queuedIssues[0];
  let prd = parsePrdFromBody(next.body);

  if (!prd) {
    log(`Issue #${next.number} "${next.title}" has no parseable PRD — generating inline...`);
    prd = generatePrdForIssue(next);
  }

  if (!prd) {
    log(`Issue #${next.number} "${next.title}" — PRD generation failed, skipping`);
    log("=== Pipeline run complete ===");
    return;
  }

  // Write PRD to .ralph/prd.json with Ralph-required metadata
  const ralphDir = resolve(ROOT, ".ralph");
  if (!existsSync(ralphDir)) mkdirSync(ralphDir, { recursive: true });

  const stories = (prd.userStories as unknown[]) ?? [];
  const now = new Date().toISOString();
  prd.branchName = "main";
  prd.phases = prd.phases ?? { "1": { name: "Phase 1", description: "" } };
  prd.metadata = {
    createdAt: now,
    lastUpdatedAt: now,
    totalStories: stories.length,
    completedStories: 0,
    currentIteration: 1,
  };

  writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2));
  log(`PRD written for: "${next.title}" (#${next.number})`);

  // Mark as in-progress on GitHub
  ghIssueEditLabels(next.number, ["pipeline:in-progress"], ["pipeline:queued"]);

  // Backward compat: update Supabase
  await updateSupabaseStatus(next.number, "in_progress");

  // Step 5: Run Ralph
  log("Step 5: Running ralph execute...");
  execSync("ralph execute", { cwd: ROOT, stdio: "inherit", env: cleanEnv });

  // Step 6: Test and push to deploy
  log("Step 6: Testing and pushing to remote...");
  testAndPush();

  log("=== Pipeline run complete ===");
}

pipeline().catch((err) => {
  log(`Pipeline failed: ${err.message}`);
  releaseLock();
  process.exit(1);
});
