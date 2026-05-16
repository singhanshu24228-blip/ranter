import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    mainImage: {
      type: String,
      required: true,
      trim: true,
    },
    additionalImage: {
      type: String,
      default: "",
      trim: true,
    },
    video: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["Clothing", "Electronics", "Bike", "Cars", "Furniture", "House"],
      required: true,
      trim: true,
    },
    rentCost: {
      type: Number,
      required: true,
      min: 1,
    },
    brandName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    productDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    pinCode: {
      type: String,
      required: true,
      match: /^\d{6}$/,
    },
    phoneNumber: {
      type: String,
      required: true,
      match: /^\d{10}$/,
    },
    ownerUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    media: {
      type: mediaSchema,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Item = mongoose.model("Item", itemSchema);
