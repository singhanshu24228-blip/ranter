import mongoose from "mongoose";

const deliveryPartnerDetailSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    vehicleType: {
      type: String,
      default: "",
    },
    vehicleNumber: {
      type: String,
      default: "",
    },
    drivingLicenseNumber: {
      type: String,
      default: "",
    },
    drivingLicenseImage: {
      type: String,
      default: "",
    },
    aadhaarNumber: {
      type: String,
      default: "",
    },
    panNumber: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const DeliveryPartnerDetail = mongoose.model("DeliveryPartnerDetail", deliveryPartnerDetailSchema);
