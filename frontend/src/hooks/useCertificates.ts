import { useQuery } from "@tanstack/react-query";
import { certificatesApi } from "@/api/certificates";

export const useCertificates = () => {
  return useQuery({
    queryKey: ["certificates", "my"],
    queryFn: async () => {
      const response = await certificatesApi.getMyCertificates();
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
