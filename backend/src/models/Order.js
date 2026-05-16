import mongoose from "mongoose";

const renterSchema = new mongoose.Schema(
  {
    panNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    },
    aadhaarNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{12}$/,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{10}$/,
    },
    pinCode: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{6}$/,
    },
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    rentalDays: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    renterUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    status: {
      type: String,
      enum: ["Placed", "Assigned", "PickedUpFromSeller", "DeliveredToRenter", "PickedUpFromRenter", "ReturnedToSeller"],
      default: "Placed",
    },
    renter: {
      type: renterSchema,
      required: false,
    },
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deliveryAcceptedAt: {
      type: Date,
      default: null,
    },
    pickedUpFromSellerAt: {
      type: Date,
      default: null,
    },
    deliveredToRenterAt: {
      type: Date,
      default: null,
    },
    pickedUpFromRenterAt: {
      type: Date,
      default: null,
    },
    returnedToSellerAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Order = mongoose.model("Order", orderSchema);
