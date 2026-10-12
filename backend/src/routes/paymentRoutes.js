import { Router } from "express";
import { createPaymentOrder, verifyPayment } from "../controllers/paymentController.js";
import { requireSession } from "../middleware/session.js";
import { paymentRateLimit } from "../middleware/redisRateLimit.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/:orderId/create", paymentRateLimit, requireSession, asyncHandler(createPaymentOrder));
router.post("/:orderId/verify", paymentRateLimit, requireSession, asyncHandler(verifyPayment));

export default router;
