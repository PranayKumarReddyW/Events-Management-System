import { apiClient } from "./client";
import type { Certificate, Pagination } from "@/types";

export interface GenerateCertificatesData {
  eventId: string;
  certificateType?: "participation" | "winner";
  registrationIds: string[];
  template?: string;
}

export interface BulkGenerateCertificatesData {
  eventId: string;
  template?: string;
}

export interface GenerateCertificatesResponse {
  generated: number;
  certificates: Certificate[];
  errors: Array<{
    userId: string;
    email: string;
    error: string;
  }>;
}

export interface BulkGenerateResponse {
  participation: number;
  winner: number;
  errors: Array<{
    user: string;
    type: "participation" | "winner";
    error: string;
  }>;
}

export interface CertificateVerifyResponse {
  verified: boolean;
  data?: {
    certificateNumber: string;
    recipientName: string;
    eventTitle: string;
    eventDate: string;
    type: "participation" | "winner";
    position: number | null;
    issuedDate: string;
    issuedBy: string;
  };
}

export interface CertificatesResponse {
  data: Certificate[];
  pagination: Pagination;
  stats?: {
    totalCertificates: number;
    byType: Array<{
      type: "participation" | "winner";
      count: number;
    }>;
    totalDownloads: number;
  };
}

export interface CertificateStatsResponse {
  overall: {
    totalCertificates: number;
    byType: string[];
    totalDownloads: number;
    avgDownloadsPerCertificate: number;
  };
  byType: Array<{
    _id: "participation" | "winner";
    count: number;
    downloads: number;
  }>;
  recent: Certificate[];
}

export const certificatesApi = {
  // Get certificate by ID (public)
  getCertificate: async (id: string) => {
    return apiClient.get<Certificate>(`/certificates/${id}`);
  },

  // Download certificate PDF (public)
  downloadCertificate: async (id: string, certificateNumber: string) => {
    return apiClient.downloadFile(
      `/certificates/${id}/download`,
      `Certificate_${certificateNumber}.pdf`
    );
  },

  // Verify certificate (public)
  verifyCertificate: async (
    certificateNumber: string,
    verificationCode?: string
  ) => {
    return apiClient.get<CertificateVerifyResponse>(
      `/certificates/verify/${certificateNumber}`,
      verificationCode ? { verificationCode } : undefined
    );
  },

  // Get my certificates
  getMyCertificates: async () => {
    return apiClient.get<Certificate[]>("/certificates/my");
  },

  // Generate certificates (organizer+)
  generateCertificates: async (data: GenerateCertificatesData) => {
    return apiClient.post<GenerateCertificatesResponse>(
      "/certificates/generate",
      data
    );
  },

  // Bulk generate certificates (organizer+)
  bulkGenerateCertificates: async (data: BulkGenerateCertificatesData) => {
    return apiClient.post<BulkGenerateResponse>(
      "/certificates/bulk-generate",
      data
    );
  },

  // Get event certificates (organizer+)
  getEventCertificates: async (
    eventId: string,
    filters?: {
      type?: "participation" | "winner";
      page?: number;
      limit?: number;
    }
  ) => {
    return apiClient.get<CertificatesResponse>(
      `/certificates/event/${eventId}`,
      filters
    );
  },

  // Regenerate certificate (organizer+)
  regenerateCertificate: async (id: string) => {
    return apiClient.post<Certificate>(`/certificates/${id}/regenerate`);
  },

  // Revoke certificate (admin)
  revokeCertificate: async (id: string, reason?: string) => {
    return apiClient.delete(`/certificates/${id}`, { data: { reason } });
  },

  // Get certificate stats (admin)
  getCertificateStats: async () => {
    return apiClient.get<CertificateStatsResponse>("/certificates/stats");
  },
};
