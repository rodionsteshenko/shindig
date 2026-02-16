/**
 * Ralph Trigger Script (US-015)
 *
 * Fetches the next queued feature (highest votes first), marks it as
 * in_progress, and outputs its PRD JSON to stdout so it can be piped
 * to `ralph process-prd`.
 *
 * Run: npx tsx --env-file=.env.local scripts/trigger-ralph.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function triggerRalph() {
  // 1. Fetch next queued feature, ordered by vote_count desc
  const { data: feature, error } = await supabase
    .from("feature_requests")
    .select("id, title, prd_json, vote_count")
    .eq("implementation_status", "queued")
    .order("vote_count", { ascending: false })
    .limit(1)
    .single();

  if (error || !feature) {
    console.log("No queued features");
    return;
  }

  if (!feature.prd_json) {
    console.error(`Feature "${feature.title}" has no PRD JSON — run generate-prd first`);
    process.exit(1);
  }

  // 2. Mark as in_progress
  const { error: updateError } = await supabase
    .from("feature_requests")
    .update({ implementation_status: "in_progress" })
    .eq("id", feature.id);

  if (updateError) {
    console.error(`Failed to update status: ${updateError.message}`);
    process.exit(1);
  }

  console.error(`Processing: ${feature.title} (${feature.vote_count} votes)`);

  // 3. Output PRD JSON to stdout
  console.log(JSON.stringify(feature.prd_json, null, 2));
}

triggerRalph().catch((err) => {
  console.error("Trigger script failed:", err.message);
  process.exit(1);
});
