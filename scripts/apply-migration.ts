/**
 * Helper script to verify the database schema is applied.
 *
 * The migration SQL at supabase/migrations/001_initial_schema.sql must be
 * applied via the Supabase SQL Editor (Dashboard > SQL Editor > New Query).
 *
 * This script checks if the tables exist and reports the status.
 *
 * Run: npx tsx scripts/apply-migration.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTables() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const tables = ["users", "events", "guests", "feature_requests", "feature_votes", "event_custom_fields", "custom_field_responses"];
  const results: Record<string, boolean> = {};

  for (const table of tables) {
    const { error } = await supabase.from(table).select("*").limit(0);
    results[table] = !error;
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: ready`);
    }
  }

  const allReady = Object.values(results).every(Boolean);
  if (allReady) {
    console.log("\n✅ All tables are ready! You can run the tests.");
  } else {
    console.log("\n❌ Some tables are missing. Please run the migration SQL in the Supabase SQL Editor:");
    console.log("   Dashboard: https://supabase.com/dashboard/project/jppvvoyvsxuqwluxacfu/sql/new");
    console.log("");
    console.log("   Migration files to apply:");
    console.log("   1. supabase/migrations/20260215000000_initial_schema.sql");
    console.log("   2. supabase/migrations/20260216000000_api_keys_and_features_v2.sql");
    console.log("   3. supabase/migrations/20260217000000_custom_event_fields.sql");
  }
}

checkTables().catch(console.error);
