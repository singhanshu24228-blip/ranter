import mongoose from "mongoose";
import { DeliveryEarning } from "../models/DeliveryEarning.js";
import { SellerEarning } from "../models/SellerEarning.js";

export async function getEarnings(req, res) {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  let earning = await DeliveryEarning.findOne({ deliveryPartner: userId });
  if (!earning) {
    earning = await DeliveryEarning.create({ deliveryPartner: userId });
  }

  res.json(earning);
}

export async function requestMoney(req, res) {
  const { userId } = req.params;
  const { requestAmount, upiId, qrCode, accountNumber, ifscCode } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  if (!upiId && !qrCode && !(accountNumber && ifscCode)) {
    return res.status(400).json({ message: "Please provide payment details (UPI ID, QR Code, or Bank Details)." });
  }

  const amount = Number(requestAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid request amount." });
  }

  const earning = await DeliveryEarning.findOne({ deliveryPartner: userId });
  if (!earning) {
    return res.status(404).json({ message: "Earnings record not found." });
  }

  if (amount > earning.amountLeft) {
    return res.status(400).json({ message: "Cannot request more than the amount left." });
  }

  earning.amountRequested += amount;
  earning.amountLeft -= amount;

  earning.paymentDetails = {
    upiId: upiId || "",
    qrCode: qrCode || "",
    accountNumber: accountNumber || "",
    ifscCode: ifscCode || "",
  };

  await earning.save();

  res.json({ message: "Money requested successfully.", earning });
}

export async function getSellerEarnings(req, res) {
  const { userId } = req.params;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  let earning = await SellerEarning.findOne({ sellerUser: userId });
  if (!earning) {
    earning = await SellerEarning.create({ sellerUser: userId });
  }

  res.json(earning);
}

export async function requestSellerMoney(req, res) {
  const { userId } = req.params;
  const { requestAmount, upiId, qrCode, accountNumber, ifscCode } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
  }

  if (!upiId && !qrCode && !(accountNumber && ifscCode)) {
    return res.status(400).json({ message: "Please provide payment details (UPI ID, QR Code, or Bank Details)." });
  }

  const amount = Number(requestAmount);
  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid request amount." });
  }

  const earning = await SellerEarning.findOne({ sellerUser: userId });
  if (!earning) {
    return res.status(404).json({ message: "Earnings record not found." });
  }

  if (amount > earning.amountLeft) {
    return res.status(400).json({ message: "Cannot request more than the amount left." });
  }

  earning.amountRequested += amount;
  earning.amountLeft -= amount;

  earning.paymentDetails = {
    upiId: upiId || "",
    qrCode: qrCode || "",
    accountNumber: accountNumber || "",
    ifscCode: ifscCode || "",
  };

  await earning.save();

  res.json({ message: "Money requested successfully.", earning });
}

export async function getAdminRequests(req, res) {
  const deliveryEarnings = await DeliveryEarning.find({ amountRequested: { $gt: 0 } })
    .populate("deliveryPartner", "username phoneNumber role");

  const sellerEarnings = await SellerEarning.find({ amountRequested: { $gt: 0 } })
    .populate("sellerUser", "username phoneNumber role");

  res.json({
    deliveryRequests: deliveryEarnings,
    sellerRequests: sellerEarnings,
  });
}

export async function approveRequest(req, res) {
  const { id } = req.params;
  const { type } = req.body; // "delivery" or "seller"

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "Invalid id." });
  }

  let earning;
  if (type === "delivery") {
    earning = await DeliveryEarning.findById(id);
  } else if (type === "seller") {
    earning = await SellerEarning.findById(id);
  } else {
    return res.status(400).json({ message: "Invalid type. Must be 'delivery' or 'seller'." });
  }

  if (!earning) {
    return res.status(404).json({ message: "Earning record not found." });
  }

  earning.amountRequested = 0;
  await earning.save();

  res.json({ message: "Payment approved successfully." });
}
