import mongoose from "mongoose";

const deliveryEarningSchema = new mongoose.Schema(
  {
    deliveryPartner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    amountRequested: {
      type: Number,
      default: 0,
    },
    amountLeft: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const DeliveryEarning = mongoose.model("DeliveryEarning", deliveryEarningSchema);
