import { Router } from "express";
import { assignDeliveryPartner, createOrder, getOrders, updateOrderStatus, claimItemPickup, approveOrder, deleteOrder, setDeliveryCharge } from "../controllers/orderController.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.route("/").get(getOrders).post(
  upload.fields([
    { name: "panCardImage", maxCount: 1 },
    { name: "aadhaarCardImage", maxCount: 1 },
  ]),
  createOrder
);
router.post("/:orderId/approve", approveOrder);
router.post("/:orderId/delivery-charge", setDeliveryCharge);
router.delete("/:orderId", deleteOrder);
router.post("/:orderId/assign-delivery", assignDeliveryPartner);
router.post("/:orderId/update-status", updateOrderStatus);
router.post("/claim-item/:itemId", claimItemPickup);

export default router;
