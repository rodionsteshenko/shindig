/**
 * Ralph Trigger Script (US-015)
 *
 * Fetches the next queued feature from GitHub Issues (highest reactions first),
 * marks it as in-progress, and outputs its PRD JSON to stdout so it can be
 * piped to `ralph process-prd`.
 *
 * Run: npx tsx --env-file=.env.local scripts/trigger-ralph.ts
 */

import { spawnSync } from "child_process";

interface GitHubIssue {
  number: number;
  title: string;
  body: string;
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

function triggerRalph() {
  // 1. Fetch next queued issue, sorted by reactions
  const result = spawnSync("gh", [
    "issue", "list",
    "--label", "pipeline:queued",
    "--json", "number,title,body",
    "--limit", "1",
    "--search", "sort:reactions-+1-desc",
  ], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    console.error(`gh issue list failed: ${result.stderr}`);
    process.exit(1);
  }

  let issues: GitHubIssue[];
  try {
    issues = JSON.parse(result.stdout.trim() || "[]");
  } catch {
    console.log("No queued features");
    return;
  }

  if (issues.length === 0) {
    console.log("No queued features");
    return;
  }

  const issue = issues[0];
  const prd = parsePrdFromBody(issue.body);

  if (!prd) {
    console.error(`Issue #${issue.number} "${issue.title}" has no parseable PRD — run generate-prd first`);
    process.exit(1);
  }

  // 2. Mark as in-progress
  spawnSync("gh", [
    "issue", "edit", String(issue.number),
    "--add-label", "pipeline:in-progress",
    "--remove-label", "pipeline:queued",
  ], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  console.error(`Processing: ${issue.title} (#${issue.number})`);

  // 3. Output PRD JSON to stdout
  console.log(JSON.stringify(prd, null, 2));
}

triggerRalph();
