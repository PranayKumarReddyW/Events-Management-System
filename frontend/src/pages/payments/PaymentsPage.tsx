import { useState } from "react";
import { usePayments } from "@/hooks";
import { apiClient } from "@/api/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, Download, Calendar, DollarSign } from "lucide-react";
import { formatDate } from "@/utils/date";
import { formatCurrency } from "@/utils/helpers";
import { toast } from "sonner";

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const filters = statusFilter !== "all" ? { status: statusFilter as any } : {};
  const { data: paymentsResponse, isLoading } = usePayments(filters);

  const payments =
    (paymentsResponse?.data as any)?.payments || paymentsResponse?.data || [];

  const handleDownloadInvoice = async (
    paymentId: string,
    transactionId: string
  ) => {
    try {
      const response = await apiClient
        .getRawClient()
        .get(`/payments/${paymentId}/invoice`);

      if (response.data && response.data.data && response.data.data.invoice) {
        const invoice = response.data.data.invoice;

        // Create a simple text invoice (in production, you'd generate a PDF)
        const invoiceText = `
INVOICE
=======
Invoice Number: ${invoice.invoiceNumber}
Date: ${new Date(invoice.issuedDate).toLocaleDateString()}

Bill To:
${invoice.user.name}
${invoice.user.email}

Event: ${invoice.event.title}
Registration: ${invoice.registration.number || "N/A"}

Payment Details:
Transaction ID: ${invoice.payment.transactionId}
Amount: ${invoice.payment.currency} ${invoice.payment.amount}
Payment Method: ${invoice.payment.paymentMethod}
Paid At: ${new Date(invoice.payment.paidAt).toLocaleString()}

Thank you for your payment!
        `.trim();

        const blob = new Blob([invoiceText], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = window.URL.createObjectURL(blob);
        link.download = `Invoice_${transactionId}.txt`;
        link.click();
        window.URL.revokeObjectURL(link.href);

        toast.success("Invoice downloaded successfully");
      }
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to download invoice"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">
            View your payment history and invoices
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : payments?.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No payments found</h3>
          <p className="text-muted-foreground">
            You haven't made any payments yet
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments?.map((payment: any) => {
            const event =
              typeof payment.event === "object" ? payment.event : null;
            const refund = payment.refund;
            const hasRefund = refund && refund._id;

            return (
              <Card key={payment._id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle>{event?.title || "Event Payment"}</CardTitle>
                      <CardDescription>
                        Transaction ID: {payment.transactionId || "N/A"}
                        {hasRefund && (
                          <span className="ml-2 text-orange-600 font-medium">
                            • Refund: {refund.status}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        payment.status === "completed"
                          ? "default"
                          : payment.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          {formatCurrency(
                            payment.amount,
                            payment.currency || event?.currency || "INR"
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date</p>
                        <p className="font-semibold">
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Method</p>
                        <p className="font-semibold capitalize">
                          {payment.paymentGateway ||
                            payment.paymentMethod ||
                            "Online"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      {hasRefund && (
                        <div className="text-right mr-4">
                          <p className="text-xs text-muted-foreground">
                            Refund Status
                          </p>
                          <Badge variant="secondary" className="mt-1">
                            {refund.status}
                          </Badge>
                          {refund.amount && (
                            <p className="text-xs mt-1 font-medium">
                              {formatCurrency(
                                refund.amount,
                                payment.currency || event?.currency || "INR"
                              )}
                              {refund.refundPercentage &&
                                ` (${refund.refundPercentage}%)`}
                            </p>
                          )}
                        </div>
                      )}
                      {payment.status === "completed" && !hasRefund && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadInvoice(
                              payment._id,
                              payment.transactionId
                            )
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
