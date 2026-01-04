/**
 * Payment Types and Zod Schemas
 * Fixes FE-003: Payment flow has no type safety
 */

import { z } from "zod";

// Razorpay payment order response
export const RazorpayOrderSchema = z.object({
  id: z.string().min(1, "Order ID is required"),
  entity: z.literal("order"),
  amount: z.number().int().positive("Amount must be positive"),
  amount_paid: z.number().int().nonnegative(),
  amount_due: z.number().int().nonnegative(),
  currency: z.string().length(3, "Currency must be 3 characters"),
  receipt: z.string().nullable().optional(),
  status: z.enum(["created", "attempted", "paid"]),
  attempts: z.number().int().nonnegative(),
  created_at: z.number().int().positive(),
});

export type RazorpayOrder = z.infer<typeof RazorpayOrderSchema>;

// Razorpay payment handler options
export const RazorpayOptionsSchema = z.object({
  key: z.string().min(1, "Razorpay key is required"),
  amount: z.number().int().positive("Amount must be positive"),
  currency: z.string().default("INR"),
  name: z.string().min(1, "Organization name is required"),
  description: z.string(),
  order_id: z.string().min(1, "Order ID is required"),
  prefill: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      contact: z.string().optional(),
    })
    .optional(),
  notes: z.record(z.string(), z.any()).optional(),
  theme: z
    .object({
      color: z.string().optional(),
    })
    .optional(),
  handler: z.function(),
  modal: z
    .object({
      ondismiss: z.function().optional(),
    })
    .optional(),
});

export type RazorpayOptions = z.infer<typeof RazorpayOptionsSchema>;

// Razorpay payment success response
export const RazorpaySuccessResponseSchema = z.object({
  razorpay_payment_id: z.string().min(1, "Payment ID is required"),
  razorpay_order_id: z.string().min(1, "Order ID is required"),
  razorpay_signature: z.string().min(1, "Signature is required"),
});

export type RazorpaySuccessResponse = z.infer<
  typeof RazorpaySuccessResponseSchema
>;

// Payment verification request
export const PaymentVerificationRequestSchema = z.object({
  razorpay_order_id: z.string().min(1, "Order ID is required"),
  razorpay_payment_id: z.string().min(1, "Payment ID is required"),
  razorpay_signature: z.string().min(1, "Signature is required"),
  registrationId: z.string().min(1, "Registration ID is required"),
});

export type PaymentVerificationRequest = z.infer<
  typeof PaymentVerificationRequestSchema
>;

// Payment status from backend
export const PaymentStatusSchema = z.enum(["pending", "completed", "failed"]);

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

// Payment object from backend
export const PaymentSchema = z.object({
  _id: z.string(),
  user: z.string(),
  event: z.string(),
  registration: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  paymentGateway: z.enum(["razorpay", "stripe"]),
  paymentMethod: z.string(),
  transactionId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  status: PaymentStatusSchema,
  paidAt: z.string().datetime().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  refundAmount: z.number().nonnegative().default(0),
  refundStatus: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Payment = z.infer<typeof PaymentSchema>;

// Payment initialization request
export const PaymentInitRequestSchema = z.object({
  registrationId: z.string().min(1, "Registration ID is required"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("INR"),
  paymentGateway: z.enum(["razorpay", "stripe"]).default("razorpay"),
});

export type PaymentInitRequest = z.infer<typeof PaymentInitRequestSchema>;

// Payment initialization response from backend
export const PaymentInitResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string(),
  key: z.string().min(1),
  paymentId: z.string(),
});

export type PaymentInitResponse = z.infer<typeof PaymentInitResponseSchema>;

// Safe parsing helpers
export function parseRazorpayOrder(data: unknown): RazorpayOrder {
  return RazorpayOrderSchema.parse(data);
}

export function parseRazorpaySuccessResponse(
  data: unknown
): RazorpaySuccessResponse {
  return RazorpaySuccessResponseSchema.parse(data);
}

export function parsePayment(data: unknown): Payment {
  return PaymentSchema.parse(data);
}

export function parsePaymentInitResponse(data: unknown): PaymentInitResponse {
  return PaymentInitResponseSchema.parse(data);
}

// Validation helpers
export function validatePaymentAmount(amount: number): boolean {
  return amount > 0 && Number.isFinite(amount) && Number.isInteger(amount);
}

export function validateRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  return orderId.length > 0 && paymentId.length > 0 && signature.length > 0;
}

// Type guards
export function isPaymentPending(payment: Payment): boolean {
  return payment.status === "pending";
}

export function isPaymentCompleted(payment: Payment): boolean {
  return payment.status === "completed";
}

export function isPaymentFailed(payment: Payment): boolean {
  return payment.status === "failed";
}
