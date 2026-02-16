import { test, expect } from "@playwright/test";
import { ensureTestUser, seedEvent, seedGuest, cleanupTestData } from "./helpers";
import type { Event, Guest } from "../src/lib/types";

/**
 * Security E2E tests - input validation
 * Tests that API endpoints properly validate and reject malformed input
 */

test.describe("Security: Feature API Input Validation", () => {
  test("POST /api/features with empty title returns 400", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        title: "",
        description: "A feature with empty title",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("title");
  });

  test("POST /api/features with missing title returns 400", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        description: "A feature without a title",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("title");
  });

  test("POST /api/features with whitespace-only title returns 400", async ({ request }) => {
    const response = await request.post("/api/features", {
      data: {
        title: "   ",
        description: "A feature with whitespace-only title",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("title");
  });

  test("POST /api/features with title > 200 chars returns 400", async ({ request }) => {
    const longTitle = "A".repeat(201);
    const response = await request.post("/api/features", {
      data: {
        title: longTitle,
        description: "A feature with an excessively long title",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("title");
    expect(body.errors.title).toContain("200");
  });

});

test.describe("Security: RSVP API Input Validation", () => {
  let testEvent: Event;
  let testGuest: Guest;

  test.beforeAll(async () => {
    const userId = await ensureTestUser();
    testEvent = (await seedEvent(userId, {
      title: "E2E Test Security RSVP Event",
      description: "Event for testing RSVP validation",
      location: "Test Venue",
    })) as Event;
    testGuest = (await seedGuest(testEvent.id, {
      name: "Security Test Guest",
      email: "security-test-guest@shindig.test",
    })) as Guest;
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test("POST /api/rsvp/[token] with invalid status returns 400", async ({ request }) => {
    const response = await request.post(`/api/rsvp/${testGuest.rsvp_token}`, {
      data: {
        rsvp_status: "invalid_status",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("rsvp_status");
  });

  test("POST /api/rsvp/[token] with empty status returns 400", async ({ request }) => {
    const response = await request.post(`/api/rsvp/${testGuest.rsvp_token}`, {
      data: {
        rsvp_status: "",
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("rsvp_status");
  });

  test("POST /api/rsvp/[token] with missing status returns 400", async ({ request }) => {
    const response = await request.post(`/api/rsvp/${testGuest.rsvp_token}`, {
      data: {
        plus_one_count: 1,
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("rsvp_status");
  });

  test("POST /api/rsvp/[token] with numeric status returns 400", async ({ request }) => {
    const response = await request.post(`/api/rsvp/${testGuest.rsvp_token}`, {
      data: {
        rsvp_status: 123,
      },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.errors).toHaveProperty("rsvp_status");
  });

  test("POST /api/rsvp/[token] with valid statuses succeeds", async ({ request }) => {
    // Test all valid statuses
    for (const status of ["going", "maybe", "declined"]) {
      const response = await request.post(`/api/rsvp/${testGuest.rsvp_token}`, {
        data: {
          rsvp_status: status,
        },
      });
      expect(response.status()).toBe(200);

      const body = await response.json();
      expect(body.rsvp_status).toBe(status);
    }
  });
});
