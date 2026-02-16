import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, cleanupTestData } from "./helpers";
import type { Event } from "../src/lib/types";

let testEvent: Event;
let testUserId: string;

test.beforeAll(async () => {
  testUserId = await ensureTestUser();
  testEvent = await seedEvent(testUserId, {
    title: "API Test Event",
    description: "For API route testing",
    location: "API Land",
  }) as Event;
});

test.afterAll(async () => {
  await cleanupTestData();
});

test.describe("Event API Routes", () => {
  test("GET /api/events/[slug] returns public event data", async ({ request }) => {
    const res = await request.get(`/api/events/${testEvent.slug}`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.title).toBe("API Test Event");
    expect(data.slug).toBe(testEvent.slug);
    expect(data.description).toBe("For API route testing");
  });

  test("GET /api/events/[slug] returns 404 for missing event", async ({ request }) => {
    const res = await request.get("/api/events/does-not-exist-9999");
    expect(res.status()).toBe(404);
  });

  test("GET /api/events/[slug]/calendar returns .ics file", async ({ request }) => {
    const res = await request.get(`/api/events/${testEvent.slug}/calendar`);
    expect(res.status()).toBe(200);

    const contentType = res.headers()["content-type"];
    expect(contentType).toContain("text/calendar");

    const body = await res.text();
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("SUMMARY:API Test Event");
    expect(body).toContain("LOCATION:API Land");
    expect(body).toContain("END:VCALENDAR");
  });

  test("POST /api/events requires authentication", async ({ request }) => {
    const res = await request.post("/api/events", {
      data: { title: "Unauthed Event" },
    });
    expect(res.status()).toBe(401);
  });

  test("PUT /api/events/manage/[id] requires authentication", async ({ request }) => {
    const res = await request.put(`/api/events/manage/${testEvent.id}`, {
      data: { title: "Updated" },
    });
    expect(res.status()).toBe(401);
  });

  test("DELETE /api/events/manage/[id] requires authentication", async ({ request }) => {
    const res = await request.delete(`/api/events/manage/${testEvent.id}`);
    expect(res.status()).toBe(401);
  });
});
