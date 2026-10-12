import { Router } from "express";
import { loginUser, registerDelivery, registerUser, updateUser, forgotPassword, resetPassword, sendVerificationOtp, changeEmail, deleteAccount, getSession, logout } from "../controllers/authController.js";
import { requireMatchingSessionUser, requireRole, requireSession } from "../middleware/session.js";
import { authRateLimit, sensitiveRateLimit } from "../middleware/redisRateLimit.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.get("/session", getSession);
router.post("/logout", asyncHandler(logout));
router.post("/register", authRateLimit, asyncHandler(registerUser));
router.post("/login", authRateLimit, asyncHandler(loginUser));
router.post("/register-delivery", authRateLimit, requireSession, requireRole("admin"), asyncHandler(registerDelivery));
router.put("/update/:userId", sensitiveRateLimit, requireSession, requireMatchingSessionUser, asyncHandler(updateUser));
router.post("/forgot-password", authRateLimit, asyncHandler(forgotPassword));
router.post("/reset-password", authRateLimit, asyncHandler(resetPassword));
router.post("/send-verification-otp", authRateLimit, requireSession, asyncHandler(sendVerificationOtp));
router.post("/change-email", authRateLimit, requireSession, asyncHandler(changeEmail));
router.post("/delete-account", authRateLimit, requireSession, asyncHandler(deleteAccount));

export default router;
