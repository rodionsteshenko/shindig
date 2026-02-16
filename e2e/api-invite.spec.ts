import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

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
