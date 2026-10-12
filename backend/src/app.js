import path from "node:path";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import itemRoutes from "./routes/itemRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import earningRoutes from "./routes/earningRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { sessionMiddleware } from "./middleware/session.js";
import { redisClient } from "./config/redis.js";

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

app.use(
  cors({
    origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : true,
    credentials: true,
    exposedHeaders: ["X-Search-Radius-Km"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(sessionMiddleware);

app.get("/api/health", async (_req, res) => {
  try {
    await redisClient.ping();
    res.json({ ok: true, redis: "connected" });
  } catch {
    res.status(503).json({ ok: false, redis: "unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/earnings", earningRoutes);
app.use("/api/payments", paymentRoutes);

if (process.env.NODE_ENV === "production") {
  const frontendDistPath = path.resolve("..", "frontend", "dist");
  app.use(express.static(frontendDistPath));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

export default app;
