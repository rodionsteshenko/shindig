/**
 * Feature Pipeline Orchestrator
 *
 * Runs the full feature processing pipeline:
 *   1. Judge open features (Claude evaluates submissions)
 *   2. Generate PRDs for approved features
 *   3. Pick up or continue a feature for Ralph to implement
 *
 * Designed to be run repeatedly (e.g. via launchd cron). Each invocation
 * fully implements one feature via `ralph execute`, completing all user
 * stories in its PRD before exiting.
 *
 * Run: npx tsx --env-file=.env.local scripts/pipeline.ts
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");
const PRD_PATH = resolve(ROOT, ".ralph", "prd.json");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Clean env without CLAUDECODE so nested claude/ralph calls work
const cleanEnv = { ...process.env };
delete cleanEnv.CLAUDECODE;

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
      prd.branchName = "ralph/pipeline-feature";
      dirty = true;
    }
    if (dirty) {
      writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2));
    }
  } catch {
    // ignore parse errors
  }
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

async function pipeline() {
  log("=== Shindig Feature Pipeline ===");

  // Step 1: Judge open features
  log("Step 1: Judging open features...");
  try {
    runScript("judge-features.ts");
  } catch (err) {
    log(`Judge step failed: ${err instanceof Error ? err.message : String(err)}`);
    // Non-fatal — continue with whatever is already approved
  }

  // Step 2: Generate PRDs for approved features
  log("Step 2: Generating PRDs for approved features...");
  try {
    runScript("generate-prd.ts");
  } catch (err) {
    log(`PRD generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Check if there's a feature currently in progress
  log("Step 3: Checking for in-progress features...");

  const { data: inProgress } = await supabase
    .from("feature_requests")
    .select("id, title, prd_json")
    .eq("implementation_status", "in_progress")
    .limit(1)
    .single();

  if (inProgress) {
    // Check if Ralph has finished all stories for this feature
    if (prdIsComplete()) {
      log(`Completed: "${inProgress.title}" — marking as done`);
      await supabase
        .from("feature_requests")
        .update({ implementation_status: "completed" })
        .eq("id", inProgress.id);
    } else {
      log(`Continuing: "${inProgress.title}"`);
      ensurePrdMetadata();
      execSync("ralph execute", { cwd: ROOT, stdio: "inherit", env: cleanEnv });
      log("=== Pipeline run complete ===");
      return;
    }
  }

  // Step 4: Pick the next queued feature
  log("Step 4: Picking next queued feature...");

  const { data: next } = await supabase
    .from("feature_requests")
    .select("id, title, prd_json, vote_count")
    .eq("implementation_status", "queued")
    .order("vote_count", { ascending: false })
    .limit(1)
    .single();

  if (!next) {
    log("No queued features — nothing to implement.");
    log("=== Pipeline run complete ===");
    return;
  }

  if (!next.prd_json) {
    log(`Feature "${next.title}" has no PRD JSON — skipping`);
    log("=== Pipeline run complete ===");
    return;
  }

  // Write PRD to .ralph/prd.json with Ralph-required metadata
  const ralphDir = resolve(ROOT, ".ralph");
  if (!existsSync(ralphDir)) mkdirSync(ralphDir, { recursive: true });

  const prd = next.prd_json as Record<string, unknown>;
  const stories = (prd.userStories as unknown[]) ?? [];
  const now = new Date().toISOString();
  prd.branchName = prd.branchName ?? `ralph/feature-${next.id.slice(0, 8)}`;
  prd.phases = prd.phases ?? { "1": { name: "Phase 1", description: "" } };
  prd.metadata = {
    createdAt: now,
    lastUpdatedAt: now,
    totalStories: stories.length,
    completedStories: 0,
    currentIteration: 1,
  };

  writeFileSync(PRD_PATH, JSON.stringify(prd, null, 2));
  log(`PRD written for: "${next.title}" (${next.vote_count} votes)`);

  // Mark as in_progress
  await supabase
    .from("feature_requests")
    .update({ implementation_status: "in_progress" })
    .eq("id", next.id);

  // Step 5: Run Ralph
  log("Step 5: Running ralph execute...");
  execSync("ralph execute", { cwd: ROOT, stdio: "inherit", env: cleanEnv });

  log("=== Pipeline run complete ===");
}

pipeline().catch((err) => {
  log(`Pipeline failed: ${err.message}`);
  process.exit(1);
});
