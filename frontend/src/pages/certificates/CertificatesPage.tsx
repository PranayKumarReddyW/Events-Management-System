import { useState } from "react";
import { useCertificates } from "@/hooks";
import { certificatesApi } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Search, Download, Share2 } from "lucide-react";
import { formatDate } from "@/utils/date";
import { toast } from "sonner";

export default function CertificatesPage() {
  const [search, setSearch] = useState("");
  const { data: certificatesResponse, isLoading } = useCertificates();

  const certificates = certificatesResponse?.data?.certificates || [];

  const handleDownload = async (
    certificateId: string,
    certificateNumber: string
  ) => {
    // NULL CHECK: Validate parameters
    if (!certificateId || !certificateNumber) {
      toast.error("Invalid certificate");
      return;
    }

    try {
      await certificatesApi.downloadCertificate(
        certificateId,
        certificateNumber
      );
      toast.success("Certificate download started");
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to download certificate"
      );
    }
  };

  const handleShare = (certificateId: string) => {
    // NULL CHECK: Validate certificateId
    if (!certificateId) {
      toast.error("Invalid certificate");
      return;
    }

    const shareUrl = `${window.location.origin}/certificates/verify/${certificateId}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Certificate link copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Certificates</h1>
          <p className="text-muted-foreground">
            View and download your earned certificates
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search certificates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : certificates?.length === 0 ? (
        <div className="text-center py-12">
          <Award className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No certificates yet</h3>
          <p className="text-muted-foreground">
            {search
              ? "No certificates match your search"
              : "Participate in events to earn certificates"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates?.map((cert: any) => (
            <Card key={cert._id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="line-clamp-2">
                      {cert.event?.title || "Event Certificate"}
                    </CardTitle>
                    <CardDescription>
                      Issued on {formatDate(cert.issuedDate)}
                    </CardDescription>
                  </div>
                  <Badge variant="default">
                    <Award className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-lg border-2 border-primary/20">
                  <div className="text-center space-y-2">
                    <Award className="h-12 w-12 mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Certificate No.
                    </p>
                    <p className="font-mono text-sm font-semibold">
                      {cert.certificateNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Verification Code: {cert.verificationCode}
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() =>
                    handleDownload(cert._id, cert.certificateNumber)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleShare(cert._id)}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
