import "./config/env.js";
import app from "./app.js";
import { connectDb } from "./config/db.js";
import { connectRedis, redisClient } from "./config/redis.js";

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDb();
    await connectRedis();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
    process.exit(1);
  }
}

startServer();
