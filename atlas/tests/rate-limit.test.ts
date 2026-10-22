import { expect, it } from "vitest";
import { RateLimiter } from "../server/rate-limit";

it("limits each client per window and resets after it", () => {
  let now = 0;
  const limiter = new RateLimiter(2, 1000, () => now);
  expect(limiter.take("a")).toBe(true);
  expect(limiter.take("a")).toBe(true);
  expect(limiter.take("a")).toBe(false);
  expect(limiter.take("b")).toBe(true);
  now = 1000;
  expect(limiter.take("a")).toBe(true);
});
