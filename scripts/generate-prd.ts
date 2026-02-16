/**
 * PRD Generator Script (US-013)
 *
 * Queries approved features that haven't been processed yet, asks Claude
 * to generate a Ralph-compatible PRD JSON for each, stores it in the
 * prd_json column, and sets implementation_status to 'queued'.
 *
 * Run: npx tsx --env-file=.env.local scripts/generate-prd.ts
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generatePrd() {
  // 1. Query approved features that haven't been processed
  const { data: features, error } = await supabase
    .from("feature_requests")
    .select("id, title, description, type, author_name, vote_count, ai_reason")
    .eq("status", "approved")
    .eq("implementation_status", "none");

  if (error) {
    throw new Error(`Failed to query features: ${error.message}`);
  }

  if (!features || features.length === 0) {
    console.log("No approved features to process");
    return;
  }

  console.log(`Found ${features.length} approved feature(s) to generate PRDs for...`);

  // 2. Generate PRD for each feature
  for (const feature of features) {
    console.log(`\nGenerating PRD for: ${feature.title}`);

    const prompt = `You are a product manager generating a PRD for a development agent called Ralph.

Generate a PRD JSON object for the following feature request for Shindig, an event planning web app built with Next.js 15, React 19, TypeScript, Tailwind CSS, and Supabase.

Feature details:
- Title: ${feature.title}
- Type: ${feature.type}
- Description: ${feature.description || "(none provided)"}
- Author: ${feature.author_name}
- Votes: ${feature.vote_count}
- AI Assessment: ${feature.ai_reason || "(none)"}

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
      console.error(
        `  Claude CLI failed for ${feature.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }

    // Parse response — strip markdown fences if present
    let cleaned = result;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let prd: Record<string, unknown>;
    try {
      prd = JSON.parse(cleaned);
    } catch {
      console.error(`  Failed to parse PRD JSON for ${feature.id}:`);
      console.error(result);
      continue;
    }

    // 3. Store PRD and update status
    const { error: updateError } = await supabase
      .from("feature_requests")
      .update({
        prd_json: prd,
        implementation_status: "queued",
      })
      .eq("id", feature.id);

    if (updateError) {
      console.error(`  Failed to update ${feature.id}: ${updateError.message}`);
    } else {
      const storyCount =
        Array.isArray((prd as { userStories?: unknown[] }).userStories)
          ? (prd as { userStories: unknown[] }).userStories.length
          : 0;
      console.log(`  PRD generated with ${storyCount} user stories — queued for Ralph`);
    }
  }

  console.log("\nDone.");
}

generatePrd().catch((err) => {
  console.error("PRD generator failed:", err.message);
  process.exit(1);
});
