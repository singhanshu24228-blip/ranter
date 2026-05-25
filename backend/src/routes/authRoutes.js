import { Router } from "express";
import { loginUser, registerDelivery, registerUser, updateUser, forgotPassword, resetPassword, sendVerificationOtp, changeEmail, deleteAccount } from "../controllers/authController.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/register-delivery", registerDelivery);
router.put("/update/:userId", updateUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/send-verification-otp", sendVerificationOtp);
router.post("/change-email", changeEmail);
router.post("/delete-account", deleteAccount);

export default router;
