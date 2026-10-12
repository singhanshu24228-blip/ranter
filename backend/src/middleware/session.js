import crypto from "node:crypto";
import session from "express-session";
import { RedisStore } from "connect-redis";
import { redisClient } from "../config/redis.js";

const sessionTtlSeconds = 7 * 24 * 60 * 60;
const sessionSecret = process.env.SESSION_SECRET;

if (process.env.NODE_ENV === "production" && !sessionSecret) {
  throw new Error("SESSION_SECRET must be configured in production.");
}

export const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
    prefix: "session:",
    ttl: sessionTtlSeconds,
  }),
  name: "ranter.sid",
  secret: sessionSecret || crypto.randomBytes(32).toString("hex"),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: sessionTtlSeconds * 1000,
  },
});

export function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        reject(regenerateError);
        return;
      }

      req.session.user = {
        ...user,
        _id: String(user._id),
      };
      req.session.save((saveError) => {
        if (saveError) {
          reject(saveError);
          return;
        }
        resolve(req.session.user);
      });
    });
  });
}

export function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export function requireSession(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: "Please log in to continue." });
  }

  req.user = req.session.user;
  next();
}

export function requireMatchingSessionUser(req, res, next) {
  if (req.user.role === "admin") {
    return next();
  }

  const suppliedIds = [
    req.params.userId,
    req.query.userId,
    req.query.ownerUserId,
    req.query.deliveryUserId,
    req.query.adminId,
    req.body?.userId,
    req.body?.ownerUserId,
    req.body?.deliveryUserId,
    req.body?.adminId,
  ].filter(Boolean);

  if (suppliedIds.some((id) => id !== req.user._id)) {
    return res.status(403).json({ message: "You cannot act on behalf of another user." });
  }

  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You are not allowed to perform this action." });
    }
    next();
  };
}

export function requireSessionForOwnerQuery(req, res, next) {
  if (!req.query.ownerUserId) {
    return next();
  }

  requireSession(req, res, () => requireMatchingSessionUser(req, res, next));
}