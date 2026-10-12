import crypto from "crypto";
import Razorpay from "razorpay";
import { Order } from "../models/Order.js";
import { sendEmail } from "../utils/email.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_live_Ss66wqcYTIqaEk",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "h1OAPSZBFa4Llv6k8iFuu35d",
});

function getAmountDue(order) {
  const paidRentalDays = order.isPaid
    ? order.renter.rentalDays
    : (order.paidRentalDays || 0);
  const unpaidRentalDays = Math.max(0, order.renter.rentalDays - paidRentalDays);
  const unpaidDeliveryCharge = paidRentalDays === 0 ? (order.deliveryCharge || 0) : 0;

  return (unpaidRentalDays * order.item.rentCost) + unpaidDeliveryCharge;
}

export async function createPaymentOrder(req, res) {
  const { orderId } = req.params;

  try {
    const order = await Order.findById(orderId).populate("item");
    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (req.user.role !== "admin" && String(order.renterUser) !== req.user._id) {
      return res.status(403).json({ message: "You can only pay for your own orders." });
    }

    const amountDue = getAmountDue(order);

    if (amountDue <= 0) {
      return res.status(400).json({ message: "Order is already paid." });
    }

    const options = {
      amount: Math.round(amountDue * 100), // amount in smallest currency unit (paise)
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
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Payment verification details are incomplete." });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "h1OAPSZBFa4Llv6k8iFuu35d";
    
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const existingOrder = await Order.findById(orderId).populate("item");
    if (!existingOrder) {
      return res.status(404).json({ message: "Order not found." });
    }
    if (req.user.role !== "admin" && String(existingOrder.renterUser) !== req.user._id) {
      return res.status(403).json({ message: "You can only verify payment for your own orders." });
    }

    const paymentOrder = await razorpay.orders.fetch(razorpay_order_id);
    const amountDuePaise = Math.round(getAmountDue(existingOrder) * 100);
    if (
      paymentOrder.receipt !== `receipt_order_${existingOrder._id}` ||
      paymentOrder.amount !== amountDuePaise ||
      existingOrder.isPaid
    ) {
      return res.status(400).json({ message: "Payment does not match the current rental balance." });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        isPaid: false,
        "renter.rentalDays": existingOrder.renter.rentalDays,
      },
      {
        isPaid: true,
        paidRentalDays: existingOrder.renter.rentalDays,
        razorpayPaymentId: razorpay_payment_id,
      },
      { new: true }
    ).populate("item renterUser");

    if (!order) {
      return res.status(409).json({ message: "Rental details changed during payment. Refresh and try again." });
    }

    // Generate Payment Receipt Email
    if (order.renterUser && order.renterUser.email) {
      const amountPaid = amountDuePaise / 100;
      const receiptMessage = `Payment Receipt\n\nOrder ID: ${order._id}\nItem: ${order.item.brandName}\nAmount Paid: ₹${amountPaid}\nPayment ID: ${razorpay_payment_id}\n\nThank you for renting with us!`;
      sendEmail(order.renterUser.email, "Payment Receipt - Rentera", receiptMessage).catch(console.error);
    }

    res.json({ message: "Payment successful", order });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Failed to verify payment." });
  }
}
