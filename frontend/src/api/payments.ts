import { apiClient } from "./client";
import type { Payment, Refund, Invoice, Pagination } from "@/types";

export interface PaymentFilters {
  status?: "pending" | "completed" | "failed";
  page?: number;
  limit?: number;
}

export interface InitiatePaymentData {
  registrationId: string;
  paymentMethod?: "stripe" | "razorpay";
}

export interface InitiatePaymentResponse {
  payment: Payment;
  clientSecret: string | null;
  orderId: string;
  amount: number;
  currency: string;
  key: string | null;
}

export interface VerifyPaymentData {
  paymentId: string;
  paymentIntentId?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

export interface VerifyPaymentResponse {
  payment: Payment;
  invoice: Invoice;
}

export interface RequestRefundData {
  reason: string;
}

export interface ProcessRefundData {
  action: "approve" | "reject";
  notes?: string;
}

// Backend returns payments directly in response, not nested
export interface PaymentsApiResponse {
  success: boolean;
  payments: Payment[];
  pagination: Pagination;
  stats?: {
    totalPayments: number;
    completedPayments: number;
    pendingPayments: number;
    failedPayments: number;
    totalAmount: number;
  };
}

export interface PaymentStatsResponse {
  overall: {
    totalPayments: number;
    completedPayments: number;
    pendingPayments: number;
    failedPayments: number;
    totalRevenue: number;
    totalRefunded: number;
  };
  byMethod: Array<{
    _id: "stripe" | "razorpay";
    count: number;
    totalAmount: number;
  }>;
}

export const paymentsApi = {
  // Initiate payment
  initiatePayment: async (data: InitiatePaymentData) => {
    return apiClient.post<InitiatePaymentResponse>("/payments/initiate", data);
  },

  // Verify payment
  verifyPayment: async (data: VerifyPaymentData) => {
    return apiClient.post<VerifyPaymentResponse>("/payments/verify", data);
  },

  // Get payment by ID
  getPayment: async (id: string) => {
    return apiClient.get<Payment>(`/payments/${id}`);
  },

  // Get my payments
  getMyPayments: async (
    filters?: PaymentFilters
  ): Promise<PaymentsApiResponse> => {
    return apiClient.get<PaymentsApiResponse>(
      "/payments/my",
      filters
    ) as Promise<PaymentsApiResponse>;
  },

  // Request refund
  requestRefund: async (id: string, data: RequestRefundData) => {
    return apiClient.post<Refund>(`/payments/${id}/refund`, data);
  },

  // Get event payments (organizer+)
  getEventPayments: async (
    eventId: string,
    filters?: PaymentFilters
  ): Promise<PaymentsApiResponse> => {
    return apiClient.get<PaymentsApiResponse>(
      `/payments/event/${eventId}`,
      filters
    ) as Promise<PaymentsApiResponse>;
  },

  // Process refund (organizer+)
  processRefund: async (id: string, data: ProcessRefundData) => {
    return apiClient.put<Refund>(`/payments/refunds/${id}/process`, data);
  },

  // Get payment stats (admin)
  getPaymentStats: async (startDate?: string, endDate?: string) => {
    return apiClient.get<PaymentStatsResponse>("/payments/stats", {
      startDate,
      endDate,
    });
  },
};
