import { redisClient } from "../config/redis.js";

const incrementScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return { current, redis.call('TTL', KEYS[1]) }
`;

export function redisRateLimit({ prefix, max, windowSeconds }) {
  return async (req, res, next) => {
    const key = `${prefix}:${req.ip || req.socket.remoteAddress || "unknown"}`;

    try {
      const [count, ttl] = await redisClient.eval(incrementScript, {
        keys: [key],
        arguments: [String(windowSeconds)],
      });

      res.set("RateLimit-Limit", String(max));
      res.set("RateLimit-Remaining", String(Math.max(0, max - Number(count))));

      if (Number(count) > max) {
        res.set("Retry-After", String(Math.max(1, Number(ttl))));
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }

      next();
    } catch (error) {
      console.error("Redis rate limiter failed:", error.message);
      res.status(503).json({ message: "Request protection is temporarily unavailable." });
    }
  };
}

export const authRateLimit = redisRateLimit({
  prefix: "rate:auth",
  max: 10,
  windowSeconds: 15 * 60,
});

export const sensitiveRateLimit = redisRateLimit({
  prefix: "rate:sensitive",
  max: 60,
  windowSeconds: 60,
});

export const paymentRateLimit = redisRateLimit({
  prefix: "rate:payment",
  max: 10,
  windowSeconds: 60,
});