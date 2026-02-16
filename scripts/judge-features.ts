/**
 * Feature Judge Script (US-012)
 *
 * Queries open feature requests from Supabase, asks Claude to evaluate them,
 * and updates each row with an AI verdict, reason, severity, and status.
 *
 * Run: npx tsx --env-file=.env.local scripts/judge-features.ts
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Verdict {
  id: string;
  ai_verdict: "approved" | "rejected" | "needs_clarification";
  ai_reason: string;
  severity?: "critical" | "high" | "medium" | "low";
  status: "approved" | "rejected" | "needs_clarification";
}

async function judgeFeatures() {
  // 1. Query open features
  const { data: features, error } = await supabase
    .from("feature_requests")
    .select("id, title, description, type, author_name, vote_count")
    .eq("status", "open");

  if (error) {
    throw new Error(`Failed to query features: ${error.message}`);
  }

  if (!features || features.length === 0) {
    console.log("No pending features");
    return;
  }

  console.log(`Found ${features.length} pending feature(s) to judge...`);

  // 2. Build the prompt
  const featureList = features
    .map(
      (f) =>
        `- ID: ${f.id}\n  Title: ${f.title}\n  Type: ${f.type}\n  Description: ${f.description || "(none)"}\n  Author: ${f.author_name}\n  Votes: ${f.vote_count}`
    )
    .join("\n\n");

  const prompt = `You are a product manager triaging feature requests and bug reports for Shindig, an event planning app.

Evaluate each submission below and return a JSON array of verdicts. For each item, decide:
- ai_verdict: "approved" (valuable and feasible), "rejected" (spam, duplicate, out of scope), or "needs_clarification" (interesting but vague)
- ai_reason: A concise 1-2 sentence explanation of your verdict
- severity: For bugs only, rate as "critical", "high", "medium", or "low". Omit for feature requests.
- status: Same value as ai_verdict

Return ONLY a valid JSON array, no markdown fences, no extra text.

Example output:
[{"id":"abc-123","ai_verdict":"approved","ai_reason":"Clear and useful feature that improves host experience.","status":"approved"}]

Submissions to evaluate:

${featureList}`;

  // 3. Call Claude via CLI
  const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, "\\n");

  console.log("Asking Claude to evaluate features...");
  // Strip CLAUDECODE env var so claude CLI doesn't refuse to run nested
  const env = { ...process.env };
  delete env.CLAUDECODE;

  let result: string;
  try {
    result = execSync(
      `claude --print --dangerously-skip-permissions -p "${escapedPrompt}"`,
      {
        encoding: "utf-8",
        maxBuffer: 1024 * 1024,
        env,
      }
    ).trim();
  } catch (err) {
    throw new Error(
      `Claude CLI failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 4. Parse response — strip markdown fences if present
  let cleaned = result;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let verdicts: Verdict[];
  try {
    verdicts = JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse Claude response as JSON:");
    console.error(result);
    throw new Error("Invalid JSON response from Claude");
  }

  if (!Array.isArray(verdicts)) {
    throw new Error("Expected JSON array of verdicts");
  }

  // 5. Update each feature row
  console.log(`Updating ${verdicts.length} feature(s)...`);
  for (const v of verdicts) {
    const update: Record<string, unknown> = {
      ai_verdict: v.ai_verdict,
      ai_reason: v.ai_reason,
      status: v.status,
    };
    if (v.severity) {
      update.severity = v.severity;
    }

    const { error: updateError } = await supabase
      .from("feature_requests")
      .update(update)
      .eq("id", v.id);

    if (updateError) {
      console.error(`  Failed to update ${v.id}: ${updateError.message}`);
    } else {
      console.log(
        `  ${v.ai_verdict.toUpperCase()} — ${features.find((f) => f.id === v.id)?.title ?? v.id}`
      );
    }
  }

  console.log("Done.");
}

judgeFeatures().catch((err) => {
  console.error("Judge script failed:", err.message);
  process.exit(1);
});
