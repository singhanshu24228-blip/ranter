import mongoose from "mongoose";
import { Item } from "../models/Item.js";
import { cloudinary } from "../config/cloudinary.js";
import { Order } from "../models/Order.js";

function resolveUserId(candidate) {
  return mongoose.isValidObjectId(candidate) ? candidate : "";
}

function assertCloudinaryConfig() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error("Cloudinary environment variables are missing.");
  }
}

function uploadToCloudinary(file) {
  if (!file) {
    return Promise.resolve("");
  }

  const resourceType = file.mimetype.startsWith("video/") ? "video" : "image";
  const originalName = file.originalname.replace(/\.[^/.]+$/, "");
  const publicId = `${Date.now()}-${originalName}`.replace(/[^a-zA-Z0-9-_]/g, "-");

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ranter/items",
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

export async function createItem(req, res) {
  const {
    ownerUserId,
    category,
    rentCost,
    brandName,
    productDescription,
    address,
    pinCode,
    phoneNumber,
  } = req.body;

  if (!resolveUserId(ownerUserId)) {
    return res.status(401).json({ message: "A logged in user is required." });
  }

  if (!req.files?.mainImage?.[0]) {
    return res.status(400).json({ message: "Main image is required." });
  }

  assertCloudinaryConfig();

  const [mainImage, additionalImage, video] = await Promise.all([
    uploadToCloudinary(req.files.mainImage[0]),
    uploadToCloudinary(req.files.additionalImage?.[0]),
    uploadToCloudinary(req.files.video?.[0]),
  ]);

  const item = await Item.create({
    category,
    rentCost,
    brandName,
    productDescription,
    address,
    pinCode,
    phoneNumber,
    ownerUser: ownerUserId,
    media: {
      mainImage,
      additionalImage,
      video,
    },
  });

  res.status(201).json(item);
}

export async function getItems(req, res) {
  const { category, ownerUserId, isAvailable } = req.query;
  const query = {};

  if (category && category !== "all") {
    query.category = category;
  }

  if (resolveUserId(ownerUserId)) {
    query.ownerUser = ownerUserId;
  }

  if (isAvailable === "true") {
    query.isAvailable = true;
  } else if (isAvailable === "false") {
    query.isAvailable = false;
  }

  const items = await Item.find(query).sort({ createdAt: -1 });
  res.json(items);
}

export async function updateItem(req, res) {
  const { itemId } = req.params;
  const { ownerUserId } = req.body;

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  if (!resolveUserId(ownerUserId)) {
    return res.status(401).json({ message: "A logged in user is required." });
  }

  const {
    category,
    rentCost,
    brandName,
    productDescription,
    address,
    pinCode,
    phoneNumber,
  } = req.body;

  const item = await Item.findByIdAndUpdate(
    { _id: itemId, ownerUser: ownerUserId },
    {
      category,
      rentCost,
      brandName,
      productDescription,
      address,
      pinCode,
      phoneNumber,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!item) {
    return res.status(404).json({ message: "Item not found for this user." });
  }

  res.json(item);
}

export async function deleteItem(req, res) {
  const { itemId } = req.params;
  const { ownerUserId } = req.query;

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  if (!resolveUserId(ownerUserId)) {
    return res.status(401).json({ message: "A logged in user is required." });
  }

  const item = await Item.findOneAndDelete({ _id: itemId, ownerUser: ownerUserId });

  if (!item) {
    return res.status(404).json({ message: "Item not found for this user." });
  }

  await Order.deleteMany({ item: itemId });

  res.json({ message: "Item deleted successfully.", itemId });
}
