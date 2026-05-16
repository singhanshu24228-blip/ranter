import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Item } from "../models/Item.js";
import { User } from "../models/User.js";

export async function createOrder(req, res) {
  const { userId, itemId, panNumber, aadhaarNumber, phoneNumber, pinCode, address, rentalDays } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ message: "A logged in user is required." });
  }

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(panNumber || "")) {
    return res.status(400).json({ message: "PAN number must be a valid 10-character PAN." });
  }

  if (!/^\d{12}$/.test(aadhaarNumber || "")) {
    return res.status(400).json({ message: "Aadhaar number must be exactly 12 digits." });
  }

  if (!/^\d{10}$/.test(phoneNumber || "")) {
    return res.status(400).json({ message: "Phone number must be exactly 10 digits." });
  }

  if (!/^\d{6}$/.test(pinCode || "")) {
    return res.status(400).json({ message: "Pin code must be exactly 6 digits." });
  }

  if (!String(address || "").trim()) {
    return res.status(400).json({ message: "Destination address is required." });
  }

  const parsedRentalDays = Number(rentalDays);
  if (!Number.isInteger(parsedRentalDays) || parsedRentalDays < 1) {
    return res.status(400).json({ message: "Number of rental days must be at least 1." });
  }

  const item = await Item.findById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Item not found." });
  }

  const existingOrder = await Order.findOne({ 
    item: itemId,
    status: { $ne: "ReturnedToSeller" }
  });
  if (existingOrder) {
    return res.status(409).json({ message: "This item is already ordered." });
  }

  const order = await Order.create({
    item: itemId,
    renterUser: userId,
    renter: {
      panNumber: panNumber.toUpperCase(),
      aadhaarNumber,
      phoneNumber,
      pinCode,
      address: address.trim(),
      rentalDays: parsedRentalDays,
    },
  });
  
  await Item.findByIdAndUpdate(itemId, { isAvailable: false });

  const populatedOrder = await order.populate(["item", "renterUser", "deliveryPartner"]);
  res.status(201).json(populatedOrder);
}

export async function getOrders(req, res) {
  const { userId, view } = req.query;
  const query = {};

  if (view === "pickup_delivery") {
    if (mongoose.isValidObjectId(userId)) {
      query.$or = [{ deliveryPartner: null }, { deliveryPartner: userId }];
    } else {
      query.deliveryPartner = null;
    }
  } else if (mongoose.isValidObjectId(userId)) {
    // Return orders where user is renter OR user is the owner of the item
    const itemsOwnedByUser = await Item.find({ ownerUser: userId }).select("_id");
    const itemIds = itemsOwnedByUser.map(i => i._id);
    query.$or = [
      { renterUser: userId },
      { item: { $in: itemIds } }
    ];
  }

  const orders = await Order.find(query)
    .populate({
      path: "item",
      populate: { path: "ownerUser" },
    })
    .populate("renterUser deliveryPartner")
    .sort({ createdAt: -1 });
  res.json(orders);
}

export async function assignDeliveryPartner(req, res) {
  const { orderId } = req.params;
  const { deliveryUserId } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  if (!mongoose.isValidObjectId(deliveryUserId)) {
    return res.status(400).json({ message: "A valid delivery partner is required." });
  }

  const deliveryUser = await User.findOne({ _id: deliveryUserId, role: "delivery" });
  if (!deliveryUser) {
    return res.status(403).json({ message: "Only delivery accounts can accept deliveries." });
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [{ deliveryPartner: null }, { deliveryPartner: deliveryUserId }],
    },
    {
      deliveryPartner: deliveryUserId,
      deliveryAcceptedAt: new Date(),
      status: "Assigned",
    },
    { new: true },
  ).populate("item renterUser deliveryPartner");

  if (!order) {
    return res.status(409).json({ message: "This delivery has already been assigned." });
  }

  res.json(order);
}

export async function updateOrderStatus(req, res) {
  const { orderId } = req.params;
  const { deliveryUserId, nextStatus } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  if (!mongoose.isValidObjectId(deliveryUserId)) {
    return res.status(400).json({ message: "A valid delivery partner is required." });
  }

  const validStatuses = ["PickedUpFromSeller", "DeliveredToRenter", "PickedUpFromRenter", "ReturnedToSeller"];
  if (!validStatuses.includes(nextStatus)) {
    return res.status(400).json({ message: "Invalid status transition." });
  }

  const updateFields = { status: nextStatus };
  if (nextStatus === "PickedUpFromSeller") updateFields.pickedUpFromSellerAt = new Date();
  if (nextStatus === "DeliveredToRenter") updateFields.deliveredToRenterAt = new Date();
  if (nextStatus === "PickedUpFromRenter") updateFields.pickedUpFromRenterAt = new Date();
  if (nextStatus === "ReturnedToSeller") updateFields.returnedToSellerAt = new Date();

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      deliveryPartner: deliveryUserId,
    },
    updateFields,
    { new: true },
  ).populate({
    path: "item",
    populate: { path: "ownerUser" },
  }).populate("renterUser deliveryPartner");

  if (!order) {
    return res.status(404).json({ message: "Assigned delivery not found for this partner." });
  }

  if (nextStatus === "ReturnedToSeller") {
    await Item.findByIdAndUpdate(order.item._id, { isAvailable: true });
  }

  res.json(order);
}

export async function claimItemPickup(req, res) {
  const { itemId } = req.params;
  const { deliveryUserId } = req.body;

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  if (!mongoose.isValidObjectId(deliveryUserId)) {
    return res.status(400).json({ message: "A valid delivery partner is required." });
  }

  const deliveryUser = await User.findOne({ _id: deliveryUserId, role: "delivery" });
  if (!deliveryUser) {
    return res.status(403).json({ message: "Only delivery accounts can claim items." });
  }

  const item = await Item.findById(itemId);
  if (!item) {
    return res.status(404).json({ message: "Item not found." });
  }

  const activeOrder = await Order.findOne({ 
    item: itemId, 
    status: { $ne: "ReturnedToSeller" } 
  });

  if (activeOrder) {
    if (!activeOrder.deliveryPartner) {
      // If there's an unassigned order, just assign it to this delivery partner
      activeOrder.deliveryPartner = deliveryUserId;
      activeOrder.deliveryAcceptedAt = new Date();
      activeOrder.status = "Assigned";
      await activeOrder.save();
      const populatedOrder = await activeOrder.populate("item renterUser deliveryPartner");
      return res.status(201).json(populatedOrder);
    }
    return res.status(409).json({ message: "This item is currently active in another delivery job." });
  }

  const order = await Order.create({
    item: itemId,
    deliveryPartner: deliveryUserId,
    status: "Assigned",
    deliveryAcceptedAt: new Date(),
  });

  const populatedOrder = await order.populate("item renterUser deliveryPartner");
  res.status(201).json(populatedOrder);
}
