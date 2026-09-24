"use client";

import { useState } from "react";
import { Button } from "rizzui";
import { Download, Loader2 } from "lucide-react";
import axios from "@/app/lib/axios";
import toast from "react-hot-toast";

interface DownloadPdfButtonProps {
  approvalId: string;
  isPublic?: boolean;
  templateId?: string;
  applicantId?: string;
  token?: string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline" | "text";
  className?: string;
}

export default function DownloadPdfButton({
  approvalId,
  isPublic = false,
  templateId,
  applicantId,
  token,
  size = "sm",
  variant = "outline",
  className = "",
}: DownloadPdfButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      let response;

      if (isPublic && templateId && applicantId && token) {
        // Public download
        response = await axios.get(
          `/contract-templates/public/contract/${templateId}/${applicantId}/download-pdf?token=${token}`,
          { responseType: "blob" }
        );
      } else {
        // Authenticated download
        response = await axios.get(
          `/contract-templates/approvals/${approvalId}/download-pdf`,
          { responseType: "blob" }
        );
      }

      // Create download link
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers["content-disposition"];
      let filename = "Contract.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (error: any) {
      console.error("PDF download failed:", error);
      const message =
        error?.response?.data?.message || "Failed to download PDF";
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleDownload}
      disabled={downloading}
      className={`gap-1.5 ${className}`}
    >
      {downloading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Downloading...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Download PDF
        </>
      )}
    </Button>
  );
}
