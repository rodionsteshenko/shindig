import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

let testEvent: Event;

test.beforeAll(async () => {
  const userId = await ensureTestUser();
  testEvent = await seedEvent(userId, {
    title: "Guest API Test Event",
  }) as Event;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Guest Management API", () => {
  test("POST /api/events/manage/[id]/guests requires auth", async ({ request }) => {
    const res = await request.post(`/api/events/manage/${testEvent.id}/guests`, {
      data: { guests: [{ name: "Unauth Guest", email: "a@b.com" }] },
    });
    expect(res.status()).toBe(401);
  });

  test("GET /api/events/manage/[id]/guests requires auth", async ({ request }) => {
    const res = await request.get(`/api/events/manage/${testEvent.id}/guests`);
    expect(res.status()).toBe(401);
  });
});
