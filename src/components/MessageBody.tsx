"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { api } from "~/trpc/react";

interface MessageBodyProps {
  messageId?: number;
  bodyS3Key?: string | null;
  snippet: string;
  className?: string;
}

export function MessageBody({ messageId, bodyS3Key, snippet, className = "" }: MessageBodyProps) {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch HTML content from S3 if messageId exists
  const { data: s3Content, isLoading: fetchingS3, error: s3Error } = api.gmail.getMessageBody.useQuery(
    { messageId: messageId?.toString() || "" },
    {
      enabled: !!messageId,
      retry: 1,
    }
  );

  useEffect(() => {
    if (s3Content?.htmlBody) {
      setHtmlContent(s3Content.htmlBody);
      setError(null);
    } else if (s3Error) {
      setError("Failed to load message content");
    }
  }, [s3Content, s3Error]);

  // Show loading state
  if (messageId && fetchingS3) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading message content...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`flex items-start gap-2 text-muted-foreground ${className}`}>
        <AlertCircle className="h-4 w-4 mt-0.5 text-red-500" />
        <div>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-sm mt-1">Fallback content:</p>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {snippet}
          </div>
        </div>
      </div>
    );
  }

  // Render HTML content if available
  if (messageId && htmlContent) {
    return (
      <div className={className}>
        <div
          className="message-body text-sm leading-relaxed prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
          style={{
            // Override prose styles for better email rendering
            color: 'inherit',
            lineHeight: '1.6',
          }}
        />
        <style jsx>{`
          .message-body {
            /* Ensure emails display properly within our container */
            word-wrap: break-word;
            overflow-wrap: break-word;
          }

          .message-body img {
            max-width: 100%;
            height: auto;
          }

          .message-body table {
            max-width: 100%;
            border-collapse: collapse;
          }

          .message-body a {
            color: #3b82f6;
            text-decoration: underline;
          }

          .message-body blockquote {
            border-left: 4px solid #e5e7eb;
            padding-left: 1rem;
            margin-left: 0;
            font-style: italic;
            color: #6b7280;
          }

          /* Handle dark mode if needed */
          @media (prefers-color-scheme: dark) {
            .message-body a {
              color: #60a5fa;
            }

            .message-body blockquote {
              border-left-color: #374151;
              color: #9ca3af;
            }
          }
        `}</style>
      </div>
    );
  }

  // Fallback to snippet if no S3 content
  return (
    <div className={`text-sm leading-relaxed whitespace-pre-wrap ${className}`}>
      {snippet}
    </div>
  );
}