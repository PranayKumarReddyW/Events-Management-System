const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Razorpay = require("razorpay");
const logger = require("./logger");

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Stripe payment methods
exports.stripe = {
  createPaymentIntent: async (amount, currency = "inr", metadata = {}) => {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to smallest currency unit
        currency,
        metadata,
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error("Stripe payment intent creation failed:", error);
      throw error;
    }
  },

  verifyPayment: async (paymentIntentId) => {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        paymentIntentId
      );

      return {
        success: paymentIntent.status === "succeeded",
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      logger.error("Stripe payment verification failed:", error);
      throw error;
    }
  },

  createRefund: async (paymentIntentId, amount) => {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
      };
    } catch (error) {
      logger.error("Stripe refund failed:", error);
      throw error;
    }
  },

  constructWebhookEvent: (payload, signature) => {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      logger.error("Stripe webhook verification failed:", error);
      throw error;
    }
  },
};

// Razorpay payment methods
exports.razorpay = {
  createOrder: async (amount, currency = "INR", receipt, notes = {}) => {
    try {
      const order = await razorpayInstance.orders.create({
        amount: Math.round(amount * 100), // Convert to paise
        currency,
        receipt,
        notes,
      });

      return {
        success: true,
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
      };
    } catch (error) {
      logger.error("Razorpay order creation failed:", error);
      throw error;
    }
  },

  verifyPayment: async (orderId, paymentId, signature) => {
    try {
      const crypto = require("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = expectedSignature === signature;

      if (isValid) {
        const payment = await razorpayInstance.payments.fetch(paymentId);

        return {
          success: true,
          status: payment.status,
          amount: payment.amount / 100,
          currency: payment.currency,
          method: payment.method,
        };
      }

      return { success: false, message: "Invalid signature" };
    } catch (error) {
      logger.error("Razorpay payment verification failed:", error);
      throw error;
    }
  },

  createRefund: async (paymentId, amount) => {
    try {
      const refund = await razorpayInstance.payments.refund(paymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
      };
    } catch (error) {
      logger.error("Razorpay refund failed:", error);
      throw error;
    }
  },

  verifyWebhookSignature: (payload, signature) => {
    try {
      const crypto = require("crypto");
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest("hex");

      return expectedSignature === signature;
    } catch (error) {
      logger.error("Razorpay webhook verification failed:", error);
      throw error;
    }
  },
};

// Generic payment handler
exports.processPayment = async (gateway, amount, metadata) => {
  switch (gateway) {
    case "stripe":
      return await exports.stripe.createPaymentIntent(amount, "inr", metadata);
    case "razorpay":
      return await exports.razorpay.createOrder(
        amount,
        "INR",
        metadata.receipt,
        metadata
      );
    default:
      throw new Error("Invalid payment gateway");
  }
};

module.exports = exports;
