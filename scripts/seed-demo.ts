/**
 * Idempotent script to create a demo event at /e/demo with sample guests.
 *
 * Creates a system user via admin API, then inserts a demo event (slug: "demo")
 * with sample guests in various RSVP states.
 *
 * Run: npx tsx --env-file=.env.local scripts/seed-demo.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const DEMO_EMAIL = "demo@shindig.app";
const DEMO_PASSWORD = "demo-system-user-password-2024!";
const DEMO_SLUG = "demo";

async function seedDemo() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Check if demo event already exists
  const { data: existing } = await supabase
    .from("events")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .single();

  if (existing) {
    console.log("✅ Demo event already exists — nothing to do.");
    return;
  }

  // 2. Find or create system user for hosting the demo event
  const { data: users } = await supabase.auth.admin.listUsers();
  let demoUser = users?.users?.find((u) => u.email === DEMO_EMAIL);

  if (!demoUser) {
    console.log("Creating demo system user...");
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Shindig Demo" },
    });
    if (error) throw new Error(`Failed to create demo user: ${error.message}`);
    demoUser = data.user;
    console.log("  ✅ Demo user created");
  } else {
    console.log("  ✅ Demo user already exists");
  }

  // 3. Create the demo event
  console.log("Creating demo event...");
  const startTime = new Date();
  startTime.setDate(startTime.getDate() + 14); // 2 weeks from now
  startTime.setHours(18, 0, 0, 0);

  const endTime = new Date(startTime);
  endTime.setHours(23, 0, 0, 0);

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      host_id: demoUser!.id,
      title: "Summer Rooftop Party 🌅",
      description:
        "Join us for an evening of great food, music, and city views! " +
        "We'll have a live DJ, craft cocktails, and a taco bar. " +
        "Dress code is smart casual. Bring your good vibes!\n\n" +
        "This is a demo event to show how Shindig works. " +
        "Feel free to explore the page!",
      location: "The Rooftop at Pier 17, 89 South Street, New York, NY 10038",
      maps_url: "https://maps.google.com/?q=Pier+17+Rooftop+NYC",
      cover_image_url: "/themes/sunset.svg",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      timezone: "America/New_York",
      slug: DEMO_SLUG,
      is_public: true,
      allow_plus_ones: true,
      gift_registry_url: "https://example.com/registry",
      gift_message:
        "No gifts necessary! Your presence is the best present. " +
        "But if you insist, we have a small wishlist.",
    })
    .select()
    .single();

  if (eventError)
    throw new Error(`Failed to create demo event: ${eventError.message}`);
  console.log("  ✅ Demo event created");

  // 4. Add sample guests in various RSVP states
  console.log("Adding sample guests...");
  const guests = [
    {
      name: "Alex Johnson",
      email: "alex@example.com",
      rsvp_status: "going",
      plus_one_count: 1,
      dietary: "Vegetarian",
      message: "Can't wait! Bringing my partner.",
      responded_at: new Date().toISOString(),
    },
    {
      name: "Sam Rivera",
      email: "sam@example.com",
      rsvp_status: "going",
      plus_one_count: 0,
      dietary: null,
      message: "See you there! 🎉",
      responded_at: new Date().toISOString(),
    },
    {
      name: "Jordan Chen",
      email: "jordan@example.com",
      rsvp_status: "going",
      plus_one_count: 2,
      dietary: "Gluten-free",
      message: "Bringing the crew!",
      responded_at: new Date().toISOString(),
    },
    {
      name: "Taylor Kim",
      email: "taylor@example.com",
      rsvp_status: "maybe",
      plus_one_count: 0,
      dietary: null,
      message: "Checking my schedule, will confirm soon!",
      responded_at: new Date().toISOString(),
    },
    {
      name: "Morgan Lee",
      email: "morgan@example.com",
      rsvp_status: "maybe",
      plus_one_count: 1,
      dietary: "Vegan",
      message: null,
      responded_at: new Date().toISOString(),
    },
    {
      name: "Casey Williams",
      email: "casey@example.com",
      rsvp_status: "declined",
      plus_one_count: 0,
      dietary: null,
      message: "Sorry, out of town that weekend. Have fun!",
      responded_at: new Date().toISOString(),
    },
    {
      name: "Riley Brown",
      email: "riley@example.com",
      rsvp_status: "pending",
      plus_one_count: 0,
      dietary: null,
      message: null,
      invited_at: new Date().toISOString(),
    },
    {
      name: "Quinn Davis",
      email: "quinn@example.com",
      rsvp_status: "pending",
      plus_one_count: 0,
      dietary: null,
      message: null,
      invited_at: new Date().toISOString(),
    },
  ];

  for (const guest of guests) {
    const { error: guestError } = await supabase.from("guests").insert({
      event_id: event.id,
      ...guest,
    });
    if (guestError)
      console.log(`  ⚠️ Failed to add ${guest.name}: ${guestError.message}`);
  }

  console.log(`  ✅ ${guests.length} sample guests added`);
  console.log(
    `\n🎉 Demo event ready at /e/demo`
  );
}

seedDemo().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
