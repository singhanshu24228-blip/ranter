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
  const { requestAmount } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
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
  const { requestAmount } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(400).json({ message: "Invalid user id." });
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
  await earning.save();

  res.json({ message: "Money requested successfully.", earning });
}
