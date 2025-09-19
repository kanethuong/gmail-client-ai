"use client";

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";

interface AttachmentDownloadProps {
  attachmentId: number;
  filename: string;
  size: number;
  className?: string;
}

export function AttachmentDownload({
  attachmentId,
  filename,
  size,
  className = ""
}: AttachmentDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const utils = api.useUtils();

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      // Get download URL from tRPC using utils.fetch
      const response = await utils.gmail.getAttachmentUrl.fetch({ attachmentId: attachmentId.toString() });

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = response.downloadUrl;
      link.download = response.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download attachment:', error);
      // You could add a toast notification here
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-6 w-6 ${className}`}
      onClick={handleDownload}
      disabled={isDownloading}
      title={`Download ${filename} (${size} bytes)`}
    >
      {isDownloading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
    </Button>
  );
}