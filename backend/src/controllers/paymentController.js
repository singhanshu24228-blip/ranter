import crypto from "crypto";
import Razorpay from "razorpay";
import { Order } from "../models/Order.js";
import { sendEmail } from "../utils/email.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_live_Ss66wqcYTIqaEk",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "h1OAPSZBFa4Llv6k8iFuu35d",
});

export async function createPaymentOrder(req, res) {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).populate("item");
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.isPaid) {
      return res.status(400).json({ message: "Order is already paid." });
    }

    const totalAmount = (order.renter.rentalDays * order.item.rentCost) + (order.deliveryCharge || 0);

    const options = {
      amount: totalAmount * 100, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: `receipt_order_${order._id}`,
    };

    const paymentOrder = await razorpay.orders.create(options);
    res.json(paymentOrder);
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Failed to create payment order." });
  }
}

export async function verifyPayment(req, res) {
  const { orderId } = req.params;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  try {
    const secret = process.env.RAZORPAY_KEY_SECRET || "h1OAPSZBFa4Llv6k8iFuu35d";
    
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        isPaid: true,
        razorpayPaymentId: razorpay_payment_id,
      },
      { new: true }
    ).populate("item renterUser");

    // Generate Payment Receipt Email
    if (order.renterUser && order.renterUser.email) {
      const totalAmount = (order.renter.rentalDays * order.item.rentCost) + (order.deliveryCharge || 0);
      const receiptMessage = `Payment Receipt\n\nOrder ID: ${order._id}\nItem: ${order.item.brandName}\nAmount Paid: ₹${totalAmount}\nPayment ID: ${razorpay_payment_id}\n\nThank you for renting with us!`;
      sendEmail(order.renterUser.email, "Payment Receipt - Rentera", receiptMessage).catch(console.error);
    }

    res.json({ message: "Payment successful", order });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Failed to verify payment." });
  }
}
