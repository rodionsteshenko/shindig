import { createClient } from "@supabase/supabase-js";
import { type Page } from "@playwright/test";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

const TEST_USER_EMAIL = "e2e-test@shindig.test";
const TEST_USER_PASSWORD = "test-password-12345!";

/**
 * Ensures a test user exists in Supabase Auth. Returns the user id.
 * Uses a fixed email so we can reuse across tests.
 */
export async function ensureTestUser(): Promise<string> {
  const supabase = adminClient();

  // Try to find existing test user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === TEST_USER_EMAIL);

  if (existing) {
    return existing.id;
  }

  // Create the test user
  const { data, error } = await supabase.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  });

  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return data.user.id;
}

/**
 * Signs in as the test user by calling the test-login API route,
 * which lets Supabase SSR set the session cookies properly.
 */
export async function loginAsTestUser(page: Page): Promise<string> {
  const userId = await ensureTestUser();

  // Navigate to any page first to establish the domain for cookies
  await page.goto("/");

  // Call the test-only login endpoint — this sets cookies through the
  // proper Supabase SSR flow (server-side createClient + signInWithPassword)
  const response = await page.request.post("/api/auth/test-login", {
    data: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    },
  });

  if (!response.ok()) {
    const body = await response.json();
    throw new Error(`Failed to sign in test user: ${body.error}`);
  }

  return userId;
}

/**
 * Creates a test event via the admin client, returns the event row.
 */
export async function seedEvent(hostId: string, overrides?: Record<string, unknown>) {
  const supabase = adminClient();
  const slug = `test-event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { data, error } = await supabase
    .from("events")
    .insert({
      host_id: hostId,
      title: "Test Event",
      description: "A test event for E2E testing",
      location: "123 Test St",
      start_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      timezone: "America/New_York",
      slug,
      is_public: true,
      allow_plus_ones: true,
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to seed event: ${error.message}`);
  return data;
}

/**
 * Creates a test guest for an event via the admin client.
 */
export async function seedGuest(eventId: string, overrides?: Record<string, unknown>) {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("guests")
    .insert({
      event_id: eventId,
      name: "Test Guest",
      email: "guest@shindig.test",
      ...overrides,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to seed guest: ${error.message}`);
  return data;
}

/**
 * Cleans up all test data. Call in afterAll/afterEach.
 */
export async function cleanupTestData() {
  const supabase = adminClient();

  // Delete guests first (FK constraint)
  await supabase.from("guests").delete().like("email", "%shindig.test");
  // Delete events owned by test user
  const { data: users } = await supabase.auth.admin.listUsers();
  const testUser = users?.users?.find((u) => u.email === TEST_USER_EMAIL);
  if (testUser) {
    await supabase.from("events").delete().eq("host_id", testUser.id);
  }
  // Delete feature test data
  await supabase.from("feature_requests").delete().like("title", "E2E Test%");
}
