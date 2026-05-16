import { Router } from "express";
import { assignDeliveryPartner, createOrder, getOrders, updateOrderStatus, claimItemPickup } from "../controllers/orderController.js";

const router = Router();

router.route("/").get(getOrders).post(createOrder);
router.post("/:orderId/assign-delivery", assignDeliveryPartner);
router.post("/:orderId/update-status", updateOrderStatus);
router.post("/claim-item/:itemId", claimItemPickup);

export default router;
