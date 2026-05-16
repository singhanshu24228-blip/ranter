import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { sendEmail } from "../utils/email.js";
import crypto from "crypto";

function sanitizeUser(user) {
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    phoneNumber: user.phoneNumber,
    role: user.role,
    address: user.address || "",
  };
}

export async function registerUser(req, res) {
  const { username, email, phoneNumber, password, role, address } = req.body;
  
  if (role === "delivery") {
    return res.status(403).json({ message: "Delivery accounts can only be created by an administrator." });
  }

  const normalizedRole = "user";

  if (!String(username || "").trim()) {
    return res.status(400).json({ message: "Username is required." });
  }

  if (!/^\S+@\S+\.\S+$/.test(email || "")) {
    return res.status(400).json({ message: "Email must be valid." });
  }

  if (!/^\d{10}$/.test(phoneNumber || "")) {
    return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
  }

  if (normalizedRole === "delivery" && !String(address || "").trim()) {
    return res.status(400).json({ message: "Address is required for delivery accounts." });
  }

  if (String(password || "").length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = await User.create({
    username: username.trim(),
    email: normalizedEmail,
    phoneNumber,
    passwordHash: hashPassword(password),
    role: normalizedRole,
    address: normalizedRole === "delivery" ? address.trim() : "",
  });

  res.status(201).json({ user: sanitizeUser(user) });
}

export async function loginUser(req, res) {
  const { email, password, role } = req.body;
  const normalizedRole = role === "delivery" ? "delivery" : role === "admin" ? "admin" : "user";

  if (!/^\S+@\S+\.\S+$/.test(email || "")) {
    return res.status(400).json({ message: "Email must be valid." });
  }

  if (!String(password || "")) {
    return res.status(400).json({ message: "Password is required." });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedRole === "admin") {
    if (normalizedEmail !== "singh01@gmail.com" || password !== "anshu1234") {
      return res.status(401).json({ message: "Invalid admin email or password." });
    }

    return res.json({
      user: {
        _id: "admin-fixed-user",
        username: "Admin",
        email: "singh01@gmail.com",
        phoneNumber: "",
        role: "admin",
        address: "",
      },
    });
  }

  const user = await User.findOne({ email: normalizedEmail, role: normalizedRole });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.json({ user: sanitizeUser(user) });
}

export async function registerDelivery(req, res) {
  const { adminEmail, adminPassword, username, email, phoneNumber, password, address } = req.body;

  if (adminEmail !== "singh01@gmail.com" || adminPassword !== "anshu1234") {
    return res.status(401).json({ message: "Unauthorized. Only admin can create delivery accounts." });
  }

  if (!String(username || "").trim()) {
    return res.status(400).json({ message: "Username is required." });
  }

  if (!/^\S+@\S+\.\S+$/.test(email || "")) {
    return res.status(400).json({ message: "Email must be valid." });
  }

  if (!/^\d{10}$/.test(phoneNumber || "")) {
    return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
  }

  if (!String(address || "").trim()) {
    return res.status(400).json({ message: "Address is required for delivery accounts." });
  }

  if (String(password || "").length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  const user = await User.create({
    username: username.trim(),
    email: normalizedEmail,
    phoneNumber,
    passwordHash: hashPassword(password),
    role: "delivery",
    address: address.trim(),
  });

  res.status(201).json({ user: sanitizeUser(user) });
}

export async function updateUser(req, res) {
  const { userId } = req.params;
  const { address, phoneNumber } = req.body;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  if (address !== undefined) user.address = address;
  if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;

  await user.save();
  res.json({ user: sanitizeUser(user) });
}

export async function forgotPassword(req, res) {
  console.log("Forgot password request received for email:", req.body.email);
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  user.resetOTP = otp;
  user.resetOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
  await user.save();

  try {
    await sendEmail(
      user.email,
      "Password Reset OTP",
      `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`
    );
    res.json({ message: "OTP sent to your email." });
  } catch (error) {
    res.status(500).json({ message: "Error sending email." });
  }
}

export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password are required." });
  }

  const user = await User.findOne({ 
    email: email.trim().toLowerCase(),
    resetOTP: otp,
    resetOTPExpires: { $gt: Date.now() }
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  user.passwordHash = hashPassword(newPassword);
  user.resetOTP = undefined;
  user.resetOTPExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful." });
}
