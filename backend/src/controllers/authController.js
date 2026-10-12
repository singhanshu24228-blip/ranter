import { User } from "../models/User.js";
import { DeliveryPartnerDetail } from "../models/DeliveryPartnerDetail.js";
import { Item } from "../models/Item.js";
import { Order } from "../models/Order.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { sendEmail } from "../utils/email.js";
import { clearOtp, consumeOtp, createOtp, storeOtp } from "../utils/otp.js";
import { destroySession, establishSession } from "../middleware/session.js";

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
  const { username, email, phoneNumber, password, role, address, acceptedTerms } = req.body;
  
  if (role === "delivery") {
    return res.status(403).json({ message: "Delivery accounts can only be created by an administrator." });
  }

  if (acceptedTerms !== true) {
    return res.status(400).json({ message: "You must accept the Terms & Conditions and Privacy Policy." });
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
    acceptedTerms: true,
    acceptedTermsAt: new Date(),
    address: normalizedRole === "delivery" ? address.trim() : "",
  });

  const sanitizedUser = sanitizeUser(user);
  await establishSession(req, sanitizedUser);
  res.status(201).json({ user: sanitizedUser });
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
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminEmail || !adminPassword || normalizedEmail !== adminEmail || password !== adminPassword) {
      return res.status(401).json({ message: "Invalid admin email or password." });
    }

    const user = {
      _id: "admin-fixed-user",
      username: "Admin",
      email: adminEmail,
      phoneNumber: "",
      role: "admin",
      address: "",
    };
    await establishSession(req, user);
    return res.json({
      user,
    });
  }

  const user = await User.findOne({ email: normalizedEmail, role: normalizedRole });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const sanitizedUser = sanitizeUser(user);
  await establishSession(req, sanitizedUser);
  res.json({ user: sanitizedUser });
}

export async function registerDelivery(req, res) {
  const { username, email, phoneNumber, password, address } = req.body;

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

  await DeliveryPartnerDetail.create({ user: user._id });

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
  req.session.user = sanitizeUser(user);
  res.json({ user: sanitizeUser(user) });
}

export async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const otp = createOtp();
  const otpKey = `otp:password-reset:${user.email}`;
  await storeOtp(otpKey, otp);

  try {
    await sendEmail(
      user.email,
      "Password Reset OTP",
      `Your OTP for password reset is: ${otp}. It will expire in 10 minutes.`
    );
    res.json({ message: "OTP sent to your email." });
  } catch (error) {
    await clearOtp(otpKey);
    res.status(500).json({ message: "Error sending email." });
  }
}

export async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password are required." });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Password must be at least 6 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const validOtp = await consumeOtp(`otp:password-reset:${normalizedEmail}`, otp);
  const user = validOtp ? await User.findOne({ email: normalizedEmail }) : null;

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  user.passwordHash = hashPassword(newPassword);
  await user.save();

  res.json({ message: "Password reset successful." });
}

export async function sendVerificationOtp(req, res) {
  const { purpose = "email-change" } = req.body;
  const userId = req.user._id;

  if (!["email-change", "account-deletion"].includes(purpose)) {
    return res.status(400).json({ message: "Invalid verification purpose." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const otp = createOtp();
  const otpKey = `otp:${purpose}:${userId}`;
  await storeOtp(otpKey, otp);

  try {
    await sendEmail(
      user.email,
      "Account Verification OTP",
      `Your OTP for account verification is: ${otp}. It will expire in 10 minutes.`
    );
    res.json({ message: "OTP sent to your email." });
  } catch (error) {
    await clearOtp(otpKey);
    res.status(500).json({ message: "Error sending email." });
  }
}

export async function changeEmail(req, res) {
  const { otp, newEmail } = req.body;
  const userId = req.user._id;

  if (!userId || !otp || !newEmail) {
    return res.status(400).json({ message: "User ID, OTP, and new email are required." });
  }

  if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
    return res.status(400).json({ message: "New email must be valid." });
  }

  if (!await consumeOtp(`otp:email-change:${userId}`, otp)) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const existingEmail = await User.findOne({ email: newEmail.trim().toLowerCase() });
  if (existingEmail) {
    return res.status(409).json({ message: "An account with this email already exists." });
  }

  user.email = newEmail.trim().toLowerCase();
  await user.save();

  const sanitizedUser = sanitizeUser(user);
  req.session.user = sanitizedUser;
  res.json({ message: "Email changed successfully.", user: sanitizedUser });
}

export async function deleteAccount(req, res) {
  const { otp } = req.body;
  const userId = req.user._id;

  if (!userId || !otp) {
    return res.status(400).json({ message: "User ID and OTP are required." });
  }

  if (!await consumeOtp(`otp:account-deletion:${userId}`, otp)) {
    return res.status(400).json({ message: "Invalid or expired OTP." });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  const userItems = await Item.find({ ownerUser: userId });
  const itemIds = userItems.map(i => i._id);
  
  await Item.deleteMany({ ownerUser: userId });
  await Order.deleteMany({ item: { $in: itemIds } });
  await Order.deleteMany({ renterUser: userId });

  await User.findByIdAndDelete(userId);

  await destroySession(req);
  res.clearCookie("ranter.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Account deleted successfully." });
}

export function getSession(req, res) {
  res.json({ user: req.session?.user || null });
}

export async function logout(req, res) {
  if (req.session) {
    await destroySession(req);
  }
  res.clearCookie("ranter.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ message: "Logged out successfully." });
}
