/**
 * Seed feature_requests table from FEATURES.md roadmap.
 *
 * Parses the markdown checklist items and inserts them as open feature
 * requests so the pipeline can judge, generate PRDs, and implement them.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-features-from-roadmap.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Feature {
  title: string;
  description: string;
  section: string;
  version: string;
}

function parseFeaturesMarkdown(md: string): Feature[] {
  const features: Feature[] = [];
  let currentVersion = "";
  let currentSection = "";

  for (const line of md.split("\n")) {
    // Track version headers like "## v1.0 — MVP (Ship It)"
    const versionMatch = line.match(/^## (v[\d.]+)\s*[—–-]\s*(.+)/);
    if (versionMatch) {
      currentVersion = `${versionMatch[1]} — ${versionMatch[2].trim()}`;
      continue;
    }

    // Track section headers like "### Event Creation"
    const sectionMatch = line.match(/^### (.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Parse unchecked items like "- [ ] Create event: name, date, time"
    const itemMatch = line.match(/^- \[ \] (.+)/);
    if (itemMatch && currentSection) {
      features.push({
        title: itemMatch[1].trim(),
        description: `From the ${currentVersion} roadmap, ${currentSection} section.`,
        section: currentSection,
        version: currentVersion,
      });
    }
  }

  return features;
}

async function seedFeatures() {
  const mdPath = resolve(__dirname, "..", "FEATURES.md");
  const md = readFileSync(mdPath, "utf-8");
  const features = parseFeaturesMarkdown(md);

  if (features.length === 0) {
    console.log("No features found in FEATURES.md");
    return;
  }

  console.log(`Parsed ${features.length} features from FEATURES.md`);

  // Check which features already exist (by title) to avoid duplicates
  const { data: existing } = await supabase
    .from("feature_requests")
    .select("title");

  const existingTitles = new Set((existing ?? []).map((r) => r.title));

  const toInsert = features.filter((f) => !existingTitles.has(f.title));

  if (toInsert.length === 0) {
    console.log("All features already exist in the database — nothing to insert.");
    return;
  }

  console.log(`Inserting ${toInsert.length} new features (${features.length - toInsert.length} already exist)...`);

  // Insert in batches
  const rows = toInsert.map((f) => ({
    title: f.title,
    description: f.description,
    author_name: "Shindig Roadmap",
    author_email: null,
    type: "feature" as const,
    status: "open" as const,
    vote_count: 0,
  }));

  const { error } = await supabase.from("feature_requests").insert(rows);

  if (error) {
    throw new Error(`Failed to insert features: ${error.message}`);
  }

  console.log(`Inserted ${toInsert.length} features as 'open' — ready for the pipeline.`);
  console.log("\nRun 'npm run pipeline' to start processing them.");
}

seedFeatures().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
