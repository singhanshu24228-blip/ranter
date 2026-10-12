import { Router } from "express";
import { getEarnings, requestMoney, getSellerEarnings, requestSellerMoney, getAdminRequests, approveRequest } from "../controllers/earningController.js";
import { requireMatchingSessionUser, requireRole, requireSession } from "../middleware/session.js";
import { sensitiveRateLimit } from "../middleware/redisRateLimit.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/admin/requests", requireSession, requireRole("admin"), asyncHandler(getAdminRequests));
router.post("/admin/approve/:id", sensitiveRateLimit, requireSession, requireRole("admin"), asyncHandler(approveRequest));

router.get("/:userId", requireSession, requireMatchingSessionUser, asyncHandler(getEarnings));
router.post("/:userId/request", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(requestMoney));

router.get("/seller/:userId", requireSession, requireMatchingSessionUser, asyncHandler(getSellerEarnings));
router.post("/seller/:userId/request", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(requestSellerMoney));

export default router;
