import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{10}$/,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "delivery"],
      default: "user",
      required: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    resetOTP: {
      type: String,
    },
    resetOTPExpires: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

export const User = mongoose.model("User", userSchema);
