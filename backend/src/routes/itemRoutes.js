import { Router } from "express";
import { createItem, deleteItem, getItems, updateItem } from "../controllers/itemController.js";
import { upload } from "../middleware/upload.js";
import { requireMatchingSessionUser, requireSession, requireSessionForOwnerQuery } from "../middleware/session.js";
import { sensitiveRateLimit } from "../middleware/redisRateLimit.js";
import { cachePublicItems } from "../middleware/itemCache.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router
  .route("/")
  .get(requireSessionForOwnerQuery, cachePublicItems, asyncHandler(getItems))
  .post(
    requireSession,
    sensitiveRateLimit,
    upload.fields([
      { name: "mainImage", maxCount: 1 },
      { name: "additionalImage", maxCount: 1 },
      { name: "video", maxCount: 1 },
    ]),
    requireMatchingSessionUser,
    asyncHandler(createItem),
  );

router.route("/:itemId")
  .put(sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(updateItem))
  .delete(sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(deleteItem));

export default router;
