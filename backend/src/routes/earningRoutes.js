import { Router } from "express";
import { getEarnings, requestMoney, getSellerEarnings, requestSellerMoney } from "../controllers/earningController.js";

const router = Router();

router.get("/:userId", getEarnings);
router.post("/:userId/request", requestMoney);

router.get("/seller/:userId", getSellerEarnings);
router.post("/seller/:userId/request", requestSellerMoney);

export default router;
