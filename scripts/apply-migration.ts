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

  const tables = ["users", "events", "guests", "feature_requests", "feature_votes"];
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
    console.log("\n❌ Some tables are missing. Please run the migration SQL in the Supabase SQL Editor.");
    console.log("   File: supabase/migrations/001_initial_schema.sql");
    console.log("   Dashboard: https://supabase.com/dashboard/project/jppvvoyvsxuqwluxacfu/sql/new");
  }
}

checkTables().catch(console.error);
