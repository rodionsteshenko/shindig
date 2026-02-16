/**
 * In-memory sliding window rate limiter.
 * Skips rate limiting when NODE_ENV === 'test'.
 * Upgradeable to Redis later.
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < 3600000); // keep 1hr max
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, 300000);
}

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function checkLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter: number } {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true") {
    return { allowed: true, retryAfter: 0 };
  }

  const now = Date.now();
  const entry = store.get(key) || { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    (t) => now - t < config.windowMs
  );

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfter = Math.ceil((oldest + config.windowMs - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true, retryAfter: 0 };
}

type RateLimiter = (request: Request) => { allowed: boolean; retryAfter: number };

function createLimiter(prefix: string, config: RateLimitConfig): RateLimiter {
  return (request: Request) => {
    const clientId = getClientId(request);
    return checkLimit(`${prefix}:${clientId}`, config);
  };
}

// 20 requests per minute for public endpoints
export const publicEndpointLimiter = createLimiter("public", {
  windowMs: 60000,
  maxRequests: 20,
});

// 5 feature submissions per hour
export const featureSubmitLimiter = createLimiter("feature-submit", {
  windowMs: 3600000,
  maxRequests: 5,
});

// 30 votes per minute
export const voteLimiter = createLimiter("vote", {
  windowMs: 60000,
  maxRequests: 30,
});

// 50 emails per hour per user
export const emailSendLimiter = createLimiter("email", {
  windowMs: 3600000,
  maxRequests: 50,
});

// 10 RSVP submissions per minute
export const rsvpLimiter = createLimiter("rsvp", {
  windowMs: 60000,
  maxRequests: 10,
});
