import mongoose from "mongoose";
import { Item } from "../models/Item.js";
import { cloudinary } from "../config/cloudinary.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { invalidatePublicItemCache } from "../middleware/itemCache.js";

function resolveUserId(candidate) {
  return mongoose.isValidObjectId(candidate) ? candidate : "";
}

function resolveCoordinates(latitude, longitude) {
  if (latitude === undefined && longitude === undefined) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return undefined;
  }

  return [lng, lat];
}

function calculateDistanceKm(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const [fromLongitude, fromLatitude] = from;
  const [toLongitude, toLatitude] = to;
  const latitudeDelta = radians(toLatitude - fromLatitude);
  const longitudeDelta = radians(toLongitude - fromLongitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(fromLatitude)) *
      Math.cos(radians(toLatitude)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
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
    location: resolveCoordinates(req.body.latitude, req.body.longitude)
      ? { type: "Point", coordinates: resolveCoordinates(req.body.latitude, req.body.longitude) }
      : undefined,
    media: {
      mainImage,
      additionalImage,
      video,
    },
  });

  await invalidatePublicItemCache();
  res.status(201).json(item);
}

export async function getItems(req, res) {
  const { category, ownerUserId, isAvailable, latitude, longitude, maxDistanceKm } = req.query;
  const coordinates = resolveCoordinates(latitude, longitude);
  const requestedMaxDistanceKm = maxDistanceKm === undefined ? null : Number(maxDistanceKm);
  if (coordinates === undefined) {
    return res.status(400).json({ message: "A valid latitude and longitude are required." });
  }
  if (maxDistanceKm !== undefined && ![10, 20, 30, 50].includes(requestedMaxDistanceKm)) {
    return res.status(400).json({ message: "Distance must be 10, 20, 30, or 50 km." });
  }

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

  if (coordinates) {
    query.location = {
      $near: {
        $geometry: { type: "Point", coordinates },
        $maxDistance: (requestedMaxDistanceKm || 50) * 1000,
      },
    };
  }

  let items = await Item.find(query);
  let searchRadiusKm = 0;
  if (coordinates) {
    const distances = items.map((item) => calculateDistanceKm(coordinates, item.location.coordinates));
    searchRadiusKm = requestedMaxDistanceKm || [10, 20, 30, 50].find((radius) => distances.some((distance) => distance <= radius)) || 50;
    items = items
      .map((item, index) => ({ item, distanceKm: distances[index] }))
      .filter(({ distanceKm }) => distanceKm <= searchRadiusKm)
      .map(({ item, distanceKm }) => ({
        ...item.toObject(),
        distanceKm: Math.round(distanceKm * 10) / 10,
      }));
  } else {
    items = items.sort((first, second) => second.createdAt - first.createdAt).map((item) => item.toObject());
  }

  if (coordinates) {
    res.set("X-Search-Radius-Km", String(searchRadiusKm));
  }

  if (!ownerUserId) {
    items = items.map((item) => {
      delete item.address;
      delete item.pinCode;
      delete item.phoneNumber;
      return item;
    });
  }

  items.forEach((item) => delete item.location);
  res.json(items);
}

export async function updateItem(req, res) {
  const { itemId } = req.params;
  const { ownerUserId, adminId, isAvailable } = req.body;

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  let existingItem;

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
    existingItem = await Item.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: "Item not found." });
    }
  } else if (ownerUserId) {
    if (!resolveUserId(ownerUserId)) {
      return res.status(401).json({ message: "A logged in user is required." });
    }
    existingItem = await Item.findOne({ _id: itemId, ownerUser: ownerUserId });
    if (!existingItem) {
      return res.status(404).json({ message: "Item not found for this user." });
    }
  } else {
    return res.status(401).json({ message: "User or admin id is required." });
  }

  if (existingItem.isAvailable === false && !adminId) {
    return res.status(400).json({ message: "Cannot edit this item while it is currently rented or in delivery." });
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

  const updateData = {};
  if (category !== undefined) updateData.category = category;
  if (rentCost !== undefined) updateData.rentCost = rentCost;
  if (brandName !== undefined) updateData.brandName = brandName;
  if (productDescription !== undefined) updateData.productDescription = productDescription;
  if (address !== undefined) updateData.address = address;
  if (pinCode !== undefined) updateData.pinCode = pinCode;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
  if (adminId && isAvailable !== undefined) {
    updateData.isAvailable = isAvailable;
  }

  const item = await Item.findByIdAndUpdate(
    itemId,
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  await invalidatePublicItemCache();
  res.json(item);
}

export async function deleteItem(req, res) {
  const { itemId } = req.params;
  const { ownerUserId, adminId } = req.query;

  if (!mongoose.isValidObjectId(itemId)) {
    return res.status(400).json({ message: "Invalid item id." });
  }

  let existingItem;

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
    existingItem = await Item.findById(itemId);
    if (!existingItem) {
      return res.status(404).json({ message: "Item not found." });
    }
  } else if (ownerUserId) {
    if (!resolveUserId(ownerUserId)) {
      return res.status(401).json({ message: "A logged in user is required." });
    }
    existingItem = await Item.findOne({ _id: itemId, ownerUser: ownerUserId });
    if (!existingItem) {
      return res.status(404).json({ message: "Item not found for this user." });
    }
  } else {
    return res.status(401).json({ message: "User or admin id is required." });
  }

  if (existingItem.isAvailable === false) {
    return res.status(400).json({ message: "Cannot delete this item while it is currently rented or in delivery." });
  }

  await Item.findByIdAndDelete(itemId);
  await Order.deleteMany({ item: itemId });

  await invalidatePublicItemCache();
  res.json({ message: "Item deleted successfully.", itemId });
}
