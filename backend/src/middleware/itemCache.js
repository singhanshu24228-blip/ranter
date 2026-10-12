import crypto from "node:crypto";
import { redisClient } from "../config/redis.js";

const cachePrefix = "cache:items:";
const cacheTtlSeconds = 60;

export async function cachePublicItems(req, res, next) {
  if (req.query.ownerUserId) {
    return next();
  }

  const cacheKey = `${cachePrefix}${crypto.createHash("sha256").update(req.originalUrl).digest("hex")}`;

  try {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      const { body, headers } = JSON.parse(cached);
      for (const [name, value] of Object.entries(headers)) {
        res.set(name, value);
      }
      return res.json(body);
    }
  } catch (error) {
    console.error("Redis item cache read failed:", error.message);
  }

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode < 400) {
      const headers = {};
      const searchRadius = res.get("X-Search-Radius-Km");
      if (searchRadius) {
        headers["X-Search-Radius-Km"] = searchRadius;
      }
      redisClient.set(cacheKey, JSON.stringify({ body, headers }), { EX: cacheTtlSeconds })
        .catch((error) => console.error("Redis item cache write failed:", error.message));
    }
    return originalJson(body);
  };

  next();
}

export async function invalidatePublicItemCache() {
  try {
    for await (const keys of redisClient.scanIterator({ MATCH: `${cachePrefix}*`, COUNT: 100 })) {
      if (keys.length) {
        await redisClient.del(keys);
      }
    }
  } catch (error) {
    console.error("Redis item cache invalidation failed:", error.message);
  }
}