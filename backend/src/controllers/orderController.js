import mongoose from "mongoose";
import { Order } from "../models/Order.js";
import { Item } from "../models/Item.js";
import { User } from "../models/User.js";
import { DeliveryEarning } from "../models/DeliveryEarning.js";
import { SellerEarning } from "../models/SellerEarning.js";
import { cloudinary } from "../config/cloudinary.js";
import { sendEmail } from "../utils/email.js";

function assertCloudinaryConfig() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary environment variables are missing.");
  }
}

function uploadToCloudinary(file, folder = "ranter/orders") {
  if (!file) {
    return Promise.resolve("");
  }

  const resourceType = file.mimetype.startsWith("video/") ? "video" : "image";
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  const publicId = `${Date.now()}-${originalName}`.replace(/[^a-zA-Z0-9-_]/g, "-");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result?.secure_url || "");
      },
    );

    stream.end(file.buffer);
  });
}

export async function createOrder(req, res) {
  const { userId, itemId, phoneNumber, pinCode, address, rentalDays } = req.body;

  if (!mongoose.isValidObjectId(userId)) {
    return res.status(401).json({ message: "A logged in user is required." });
  }

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  if (!req.files?.panCardImage?.[0]) {
    return res.status(400).json({ message: "PAN card image is required." });
  }

  if (!req.files?.aadhaarCardImage?.[0]) {
    return res.status(400).json({ message: "Aadhaar card image is required." });
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
  if (parsedRentalDays > 7) {
    return res.status(400).json({ message: "Number of rental days cannot exceed 7." });
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

  assertCloudinaryConfig();

  const [panCardImage, aadhaarCardImage] = await Promise.all([
    uploadToCloudinary(req.files.panCardImage[0]),
    uploadToCloudinary(req.files.aadhaarCardImage[0]),
  ]);

  const order = await Order.create({
    item: itemId,
    renterUser: userId,
    renter: {
      panCardImage,
      aadhaarCardImage,
      phoneNumber,
      pinCode,
      address: String(address || "").trim(),
      rentalDays: parsedRentalDays,
    },
  });
  
  await Item.findByIdAndUpdate(itemId, { isAvailable: false });

  const populatedOrder = await order.populate({
    path: "item",
    populate: { path: "ownerUser" },
  });
  await populatedOrder.populate("renterUser deliveryPartner");

  try {
    if (populatedOrder.item?.ownerUser?.email) {
      const renterAddress = populatedOrder.renter?.address || "Not provided";
      const renterPhone = populatedOrder.renter?.phoneNumber || "Not provided";
      const renterPinCode = populatedOrder.renter?.pinCode || "Not provided";
      const renterName = populatedOrder.renterUser?.username || "Unknown";
      
      const sellerMessage = `Hello ${populatedOrder.item.ownerUser.username},\n\nYour product ${populatedOrder.item.brandName} has just been rented for ${populatedOrder.renter.rentalDays} days.\n\nRenter Details:\nName: ${renterName}\nPhone: ${renterPhone}\nAddress: ${renterAddress}\nPincode: ${renterPinCode}\n\nPlease keep the product ready. A delivery partner will be assigned soon.`;
      
      sendEmail(populatedOrder.item.ownerUser.email, "Your Product has been Rented", sellerMessage).catch(console.error);
    }
  } catch (error) {
    console.error("Failed to send notification email to owner:", error);
  }

  res.status(201).json(populatedOrder);
}

export async function getOrders(req, res) {
  const { userId, view } = req.query;
  const query = {};

  if (view === "pickup_delivery") {
    if (mongoose.isValidObjectId(userId)) {
      query.$or = [{ deliveryPartner: null, status: { $ne: "Placed" } }, { deliveryPartner: userId }];
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

  let orders = await Order.find(query)
    .populate({
      path: "item",
      populate: { path: "ownerUser" },
    })
    .populate("renterUser deliveryPartner")
    .sort({ createdAt: -1 });

  if (view !== "pickup_delivery" && mongoose.isValidObjectId(userId)) {
    orders = orders.map(order => {
      const obj = order.toObject();
      const isOwner = obj.item?.ownerUser?._id?.toString() === userId;
      
      if (!isOwner) {
        if (obj.item) {
          delete obj.item.address;
          delete obj.item.pinCode;
          delete obj.item.phoneNumber;
          if (obj.item.ownerUser) {
            delete obj.item.ownerUser;
          }
        }
      }
      return obj;
    });
  }

  res.json(orders);
}

export async function approveOrder(req, res) {
  const { orderId } = req.params;
  const { deliveryCharge } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  const updateFields = { status: "Approved" };
  if (deliveryCharge !== undefined) {
    updateFields.deliveryCharge = Number(deliveryCharge) || 0;
  }

  const order = await Order.findOneAndUpdate(
    { _id: orderId, status: "Placed" },
    updateFields,
    { new: true }
  ).populate({
    path: "item",
    populate: { path: "ownerUser" },
  }).populate("renterUser deliveryPartner");

  if (!order) {
    return res.status(404).json({ message: "Order not found or already approved." });
  }

  res.json(order);
}

export async function setDeliveryCharge(req, res) {
  const { orderId } = req.params;
  const { deliveryCharge } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  const parsedCharge = Number(deliveryCharge);
  if (isNaN(parsedCharge) || parsedCharge < 0) {
    return res.status(400).json({ message: "Invalid delivery charge." });
  }

  const order = await Order.findByIdAndUpdate(
    orderId,
    { deliveryCharge: parsedCharge },
    { new: true }
  ).populate({
    path: "item",
    populate: { path: "ownerUser" },
  }).populate("renterUser deliveryPartner");

  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  res.json(order);
}

export async function deleteOrder(req, res) {
  const { orderId } = req.params;
  const { adminId, userId } = req.query;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({ message: "Order not found." });
  }

  if (adminId) {
    if (adminId !== "admin-fixed-user") {
      if (!mongoose.isValidObjectId(adminId)) {
        return res.status(401).json({ message: "A logged in admin is required." });
      }
      const adminUser = await User.findById(adminId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can perform this action as admin." });
      }
    }
  } else if (userId) {
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ message: "A logged in user is required." });
    }
    if (order.renterUser.toString() !== userId) {
      return res.status(403).json({ message: "You can only delete your own orders." });
    }
    const canCancel = order.status === "Placed" || order.status === "Approved";
    const canDelete = order.status === "ReturnedToSeller";
    if (!canCancel && !canDelete) {
      return res.status(400).json({ message: "Order cannot be cancelled or deleted at this stage." });
    }
  } else {
    return res.status(401).json({ message: "User or admin id is required." });
  }

  await Order.findByIdAndDelete(orderId);

  // Restore item availability if it was cancelled and not already completed
  if (order.status !== "ReturnedToSeller") {
    await Item.findByIdAndUpdate(order.item, { isAvailable: true });
  }

  res.json({ message: "Order deleted successfully." });
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
  ).populate({
    path: "item",
    populate: { path: "ownerUser" },
  }).populate("renterUser deliveryPartner");

  if (!order) {
    return res.status(409).json({ message: "This delivery has already been assigned." });
  }

  try {
    const totalAmount = (order.renter.rentalDays * order.item.rentCost) + (order.deliveryCharge || 0);
    
    if (order.renterUser?.email) {
      const renterMessage = `Your delivery for ${order.item.brandName} has been accepted!\n\nProduct Details:\nBrand: ${order.item.brandName}\nCategory: ${order.item.category}\nRental Days: ${order.renter.rentalDays}\n\nTotal Amount: ₹${totalAmount} (${order.renter.rentalDays} days * ₹${order.item.rentCost}/day + ₹${order.deliveryCharge || 0} delivery charge)\n\nDelivery Partner Phone: ${order.deliveryPartner.phoneNumber}`;
      sendEmail(order.renterUser.email, "Your Item Delivery Accepted", renterMessage).catch(console.error);
    }

    if (order.item?.ownerUser?.email) {
      const renterAddress = order.renter?.address || "Not provided";
      const renterPhone = order.renter?.phoneNumber || "Not provided";
      const renterPinCode = order.renter?.pinCode || "Not provided";
      const renterName = order.renterUser?.username || "Unknown";

      const sellerMessage = `Your product ${order.item.brandName} has been assigned a delivery partner.\n\nKeep your product ready for pickup.\n\nDelivery Partner Phone: ${order.deliveryPartner.phoneNumber}\n\nRenter Details:\nName: ${renterName}\nPhone: ${renterPhone}\nAddress: ${renterAddress}\nPincode: ${renterPinCode}`;
      sendEmail(order.item.ownerUser.email, "Delivery Partner Assigned for your Product", sellerMessage).catch(console.error);
    }
  } catch (error) {
    console.error("Failed to send notification emails:", error);
  }

  res.json(order);
}

export async function updateOrderStatus(req, res) {
  const { orderId } = req.params;
  const { deliveryUserId, nextStatus, adminId } = req.body;

  if (!mongoose.isValidObjectId(orderId)) {
    return res.status(400).json({ message: "Invalid order id." });
  }

  let isAdmin = false;
  if (adminId) {
    if (adminId !== "admin-fixed-user") {
      if (!mongoose.isValidObjectId(adminId)) {
        return res.status(401).json({ message: "A logged in admin is required." });
      }
      const adminUser = await User.findById(adminId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Only admins can perform this action as admin." });
      }
    }
    isAdmin = true;
  } else {
    if (!mongoose.isValidObjectId(deliveryUserId)) {
      return res.status(400).json({ message: "A valid delivery partner is required." });
    }
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

  const query = { _id: orderId };
  if (!isAdmin) {
    query.deliveryPartner = deliveryUserId;
  }

  const order = await Order.findOneAndUpdate(
    query,
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
    
    // Update earnings for delivery partner
    const deliveryCharge = order.deliveryCharge || 0;
    const earningAmount = deliveryCharge * 0.90;
    
    if (earningAmount > 0) {
      await DeliveryEarning.findOneAndUpdate(
        { deliveryPartner: deliveryUserId },
        { 
          $inc: { 
            totalAmount: earningAmount,
            amountLeft: earningAmount
          }
        },
        { upsert: true, new: true }
      );
    }

    // Update earnings for seller
    if (order.item.ownerUser) {
      const rentalCharge = (order.renter?.rentalDays || 1) * (order.item.rentCost || 0);
      const sellerEarningAmount = rentalCharge * 0.90;

      if (sellerEarningAmount > 0) {
        await SellerEarning.findOneAndUpdate(
          { sellerUser: order.item.ownerUser },
          {
            $inc: {
              totalAmount: sellerEarningAmount,
              amountLeft: sellerEarningAmount
            }
          },
          { upsert: true, new: true }
        );
      }
    }
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
