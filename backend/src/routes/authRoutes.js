import { Router } from "express";
import { loginUser, registerDelivery, registerUser, updateUser, forgotPassword, resetPassword } from "../controllers/authController.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/register-delivery", registerDelivery);
router.put("/update/:userId", updateUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
