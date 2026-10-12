import { Router } from "express";
import { assignDeliveryPartner, createOrder, extendRental, getOrders, updateOrderStatus, claimItemPickup, approveOrder, deleteOrder, setDeliveryCharge } from "../controllers/orderController.js";
import { upload } from "../middleware/upload.js";
import { requireMatchingSessionUser, requireRole, requireSession } from "../middleware/session.js";
import { sensitiveRateLimit } from "../middleware/redisRateLimit.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.route("/").get(requireSession, requireMatchingSessionUser, asyncHandler(getOrders)).post(
  requireSession,
  sensitiveRateLimit,
  upload.fields([
    { name: "panCardImage", maxCount: 1 },
    { name: "aadhaarCardImage", maxCount: 1 },
  ]),
  requireMatchingSessionUser,
  asyncHandler(createOrder)
);
router.post("/:orderId/approve", sensitiveRateLimit, requireSession, requireRole("admin"), asyncHandler(approveOrder));
router.post("/:orderId/delivery-charge", sensitiveRateLimit, requireSession, requireRole("admin"), asyncHandler(setDeliveryCharge));
router.post("/:orderId/extend-rental", sensitiveRateLimit, requireSession, asyncHandler(extendRental));
router.delete("/:orderId", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(deleteOrder));
router.post("/:orderId/assign-delivery", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(assignDeliveryPartner));
router.post("/:orderId/update-status", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(updateOrderStatus));
router.post("/claim-item/:itemId", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(claimItemPickup));

export default router;
