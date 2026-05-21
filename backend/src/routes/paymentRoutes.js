import { Router } from "express";
import { createPaymentOrder, verifyPayment } from "../controllers/paymentController.js";

const router = Router();

router.post("/:orderId/create", createPaymentOrder);
router.post("/:orderId/verify", verifyPayment);

export default router;
