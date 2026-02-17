/**
 * GitHub Labels & Milestones Setup
 *
 * Creates the labels and milestones used by the feature pipeline to track
 * implementation status via GitHub Issues.
 *
 * Idempotent — safe to run multiple times.
 *
 * Run: npx tsx scripts/setup-github-labels.ts
 */

import { spawnSync } from "child_process";

const LABELS: { name: string; color: string; description: string }[] = [
  // Pipeline status
  { name: "pipeline:queued", color: "fbca04", description: "PRD generated, waiting for implementation" },
  { name: "pipeline:in-progress", color: "1d76db", description: "Currently being implemented by Ralph" },
  { name: "pipeline:completed", color: "0e8a16", description: "Implementation complete" },
  // Type
  { name: "type:feature", color: "a2eeef", description: "Feature request" },
  { name: "type:bug", color: "d73a4a", description: "Bug report" },
  // Priority
  { name: "priority:critical", color: "b60205", description: "Critical priority" },
  { name: "priority:high", color: "d93f0b", description: "High priority" },
  { name: "priority:medium", color: "fbca04", description: "Medium priority" },
  { name: "priority:low", color: "0e8a16", description: "Low priority" },
  // Source
  { name: "source:roadmap", color: "c5def5", description: "Seeded from FEATURES.md roadmap" },
  { name: "source:user", color: "e4e669", description: "Submitted via feature board" },
];

const MILESTONES: { title: string; description: string }[] = [
  { title: "v1.0 — MVP", description: "Core event creation, RSVP, guest management, and feature board" },
  { title: "v1.5 — Post-Launch Quick Wins", description: "SMS, reminders, themes, polls, social sharing" },
  { title: "v2.0 — Growth Features", description: "Collaboration, potluck signups, check-in, recurring events" },
  { title: "v3.0 — Premium / Monetization", description: "Ticketed events, guest contributions, scheduled sending" },
];

function setupLabels() {
  console.log("Setting up GitHub labels...\n");

  for (const label of LABELS) {
    const result = spawnSync("gh", [
      "label", "create", label.name,
      "--color", label.color,
      "--description", label.description,
      "--force",
    ], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status === 0) {
      console.log(`  + ${label.name} (created/updated)`);
    } else if (result.stderr.includes("already exists")) {
      console.log(`  ✓ ${label.name} (exists)`);
    } else {
      console.log(`  + ${label.name} (created/updated)`);
    }
  }
}

function setupMilestones() {
  console.log("\nSetting up GitHub milestones...\n");

  // List existing milestones
  const listResult = spawnSync("gh", [
    "api", "repos/{owner}/{repo}/milestones",
    "--jq", ".[].title",
  ], {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  const existingTitles = new Set(
    (listResult.stdout ?? "").trim().split("\n").filter(Boolean)
  );

  for (const ms of MILESTONES) {
    if (existingTitles.has(ms.title)) {
      console.log(`  ✓ ${ms.title} (exists)`);
      continue;
    }

    const body = JSON.stringify({ title: ms.title, description: ms.description, state: "open" });
    const result = spawnSync("gh", [
      "api", "repos/{owner}/{repo}/milestones",
      "-X", "POST",
      "--input", "-",
    ], {
      input: body,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status === 0) {
      console.log(`  + ${ms.title} (created)`);
    } else if (result.stderr.includes("already_exists") || result.stderr.includes("Validation Failed")) {
      console.log(`  ✓ ${ms.title} (exists)`);
    } else {
      console.error(`  ✗ ${ms.title} failed: ${result.stderr}`);
    }
  }
}

setupLabels();
setupMilestones();
console.log("\nDone.");
