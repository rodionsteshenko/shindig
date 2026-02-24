import { test, expect } from "@playwright/test";
import {
  ensureTestUser,
  seedEvent,
  seedGuest,
  cleanupTestData,
  loginAsTestUser,
  adminClient,
} from "./helpers";
import type { Event, Guest } from "../src/lib/types";

let testEvent: Event;

test.beforeAll(async () => {
  const userId = await ensureTestUser();
  testEvent = await seedEvent(userId, {
    title: "Invite API Test Event",
  }) as Event;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Invitation & Reminder API", () => {
  test("POST /api/events/manage/[id]/invite requires auth", async ({ request }) => {
    const res = await request.post(`/api/events/manage/${testEvent.id}/invite`);
    expect(res.status()).toBe(401);
  });

  test("POST /api/events/manage/[id]/remind requires auth", async ({ request }) => {
    const res = await request.post(`/api/events/manage/${testEvent.id}/remind`);
    expect(res.status()).toBe(401);
  });
});

test.describe("SMS Invitations", () => {
  test.afterEach(async () => {
    // Clean up guests after each test
    const supabase = adminClient();
    await supabase.from("guests").delete().eq("event_id", testEvent.id);
  });

  test("invite API returns emailsSent and smsSent counts", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test SMS Counts Event",
    });

    // Seed a guest with email only
    await seedGuest(event.id, {
      name: "Email Only Guest",
      email: "emailonly@shindig.test",
      phone: null,
    });

    // Seed a guest with phone only (will receive SMS)
    await seedGuest(event.id, {
      name: "Phone Only Guest",
      email: null,
      phone: "+15551234567",
    });

    // Make authenticated request to invite API
    const res = await page.request.post(`/api/events/manage/${event.id}/invite`, {
      data: {},
    });

    expect(res.ok()).toBe(true);
    const data = await res.json();

    // Response should have the new format with emailsSent and smsSent
    expect(data).toHaveProperty("emailsSent");
    expect(data).toHaveProperty("smsSent");
    expect(data).toHaveProperty("failed");

    // We expect 1 SMS sent (phone-only guest)
    // Email may fail if Resend is not configured, but SMS should work in test mode
    expect(data.smsSent).toBe(1);
  });

  test("phone-only guest receives SMS invitation (invited_at set)", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test SMS Invite Event",
    });

    // Seed a phone-only guest
    const guest = await seedGuest(event.id, {
      name: "SMS Guest",
      email: null,
      phone: "+15559876543",
    }) as Guest;

    // Verify invited_at is initially null
    expect(guest.invited_at).toBeNull();

    // Send invitations
    const res = await page.request.post(`/api/events/manage/${event.id}/invite`, {
      data: {},
    });

    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.smsSent).toBe(1);
    expect(data.failed).toBe(0);

    // Verify guest's invited_at was set
    const supabase = adminClient();
    const { data: updatedGuest } = await supabase
      .from("guests")
      .select("*")
      .eq("id", guest.id)
      .single();

    expect(updatedGuest.invited_at).not.toBeNull();
  });

  test("guest with both email and phone receives email only", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test Email Priority Event",
    });

    // Seed a guest with BOTH email and phone
    await seedGuest(event.id, {
      name: "Both Contact Guest",
      email: "bothcontact@shindig.test",
      phone: "+15551112222",
    });

    // Send invitations
    const res = await page.request.post(`/api/events/manage/${event.id}/invite`, {
      data: {},
    });

    expect(res.ok()).toBe(true);
    const data = await res.json();

    // Guest with both should receive email only (no SMS)
    expect(data.smsSent).toBe(0);
    // Email count depends on whether Resend is configured
    // But smsSent must be 0 to avoid duplicate notifications
  });

  test("mixed guests: email-only, phone-only, and both", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test Mixed Guests Event",
    });

    // Seed various guest types
    await seedGuest(event.id, {
      name: "Email Only",
      email: "emailonly@shindig.test",
      phone: null,
    });

    await seedGuest(event.id, {
      name: "Phone Only 1",
      email: null,
      phone: "+15551111111",
    });

    await seedGuest(event.id, {
      name: "Phone Only 2",
      email: null,
      phone: "+15552222222",
    });

    await seedGuest(event.id, {
      name: "Both Contact",
      email: "both@shindig.test",
      phone: "+15553333333",
    });

    // Send invitations
    const res = await page.request.post(`/api/events/manage/${event.id}/invite`, {
      data: {},
    });

    expect(res.ok()).toBe(true);
    const data = await res.json();

    // 2 phone-only guests should receive SMS
    expect(data.smsSent).toBe(2);

    // Total invited via some channel should be reflected
    // (emailsSent depends on Resend config, but smsSent is testable)
  });

  test("returns error when no guests with email or phone", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test No Contact Event",
    });

    // Seed a guest with NO contact info
    await seedGuest(event.id, {
      name: "No Contact Guest",
      email: null,
      phone: null,
    });

    const res = await page.request.post(`/api/events/manage/${event.id}/invite`, {
      data: {},
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No guests with email or phone");
  });
});

test.describe("Dashboard SMS Indicator", () => {
  test("shows phone icon for SMS-invited guests", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test SMS Indicator Event",
    });

    // Seed a phone-only guest who was invited
    await seedGuest(event.id, {
      name: "SMS Invited Guest",
      email: null,
      phone: "+15554567890",
      invited_at: new Date().toISOString(),
    });

    // Seed a phone-only guest who was NOT invited yet
    await seedGuest(event.id, {
      name: "Not Invited Phone Guest",
      email: null,
      phone: "+15559999999",
      invited_at: null,
    });

    await page.goto(`/dashboard/${event.id}`);

    // The invited phone-only guest should have the SMS indicator
    const invitedRow = page.locator("tr").filter({ hasText: "SMS Invited Guest" });
    await expect(invitedRow.getByTestId("sms-invited-indicator")).toBeVisible();

    // The non-invited phone-only guest should NOT have the SMS indicator
    const notInvitedRow = page.locator("tr").filter({ hasText: "Not Invited Phone Guest" });
    await expect(notInvitedRow.getByTestId("sms-invited-indicator")).not.toBeVisible();

    // The phone number should still be displayed for the non-invited guest
    await expect(notInvitedRow.getByText("(555) 999-9999")).toBeVisible();
  });

  test("shows phone number in national format for phone-only guests", async ({ page }) => {
    await cleanupTestData();
    const userId = await loginAsTestUser(page);
    const event = await seedEvent(userId, {
      title: "E2E Test Phone Format Event",
    });

    // Seed a phone-only guest with E.164 number
    await seedGuest(event.id, {
      name: "Phone Format Guest",
      email: null,
      phone: "+12125551234",
    });

    await page.goto(`/dashboard/${event.id}`);

    // Phone number should be displayed in national format
    const row = page.locator("tr").filter({ hasText: "Phone Format Guest" });
    await expect(row.getByText("(212) 555-1234")).toBeVisible();
  });
});
