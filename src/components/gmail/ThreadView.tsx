import {
  Archive,
  Trash2,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  Send,
  Sparkles,
  Loader2
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { MessageBody } from "~/components/MessageBody";
import { AttachmentDownload } from "~/components/AttachmentDownload";
import { api } from "~/trpc/react";
import { useEffect } from "react";

interface Message {
  id: number;
  from: string;
  to: string;
  subject: string;
  date: Date;
  snippet: string;
  bodyS3Key: string | null;
  attachments: {
    id: number;
    filename: string;
    size: number;
  }[];
}

interface OptimisticMessage {
  id: string;
  from: string;
  to: string;
  date: Date;
  snippet: string;
  threadId: number;
  isOptimistic: true;
  isSending?: boolean;
  isSent?: boolean;
  sentBody?: string;
}

interface ThreadData {
  thread?: {
    id: number;
    gmailThreadId: string;
  };
  messages: Message[];
}

interface ThreadViewProps {
  threadData: ThreadData;
  optimisticMessages: OptimisticMessage[];
  replyText: string;
  onReplyTextChange: (text: string) => void;
  onBack: () => void;
  onReply: (replyAll: boolean) => void;
  onForward: (messageId: string) => void;
  onDraftWithAI: () => void;
  isReplying?: boolean;
  isDraftingWithAI?: boolean;
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    return d.toLocaleDateString();
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function ThreadView({
  threadData,
  optimisticMessages,
  replyText,
  onReplyTextChange,
  onBack,
  onReply,
  onForward,
  onDraftWithAI,
  isReplying = false,
  isDraftingWithAI = false,
}: ThreadViewProps) {
  const utils = api.useUtils();

  // Prefetch message bodies for all messages in this thread
  useEffect(() => {
    const prefetchMessageBodies = async () => {
      const messages = threadData.messages || [];

      for (const message of messages) {
        if (message.id && message.bodyS3Key) {
          try {
            await utils.gmail.getMessageBody.prefetch(
              { messageId: message.id.toString() },
              {
                staleTime: 24 * 60 * 60 * 1000, // 24 hours
              }
            );
          } catch (error) {
            console.debug('Failed to prefetch message body:', message.id);
          }
        }
      }
    };

    if (threadData.messages?.length > 0) {
      // Small delay to prioritize initial render
      const timeoutId = setTimeout(prefetchMessageBodies, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [threadData.messages, utils.gmail.getMessageBody]);
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-border border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onBack}>
              ←
            </Button>
            <h2 className="font-semibold">
              {threadData.messages?.[0]?.subject || "Thread"}
            </h2>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {/* Render actual messages */}
          {threadData.messages.map((message, index) => (
            <div
              key={message.id}
              className="border-border rounded-lg border p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(message.from)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {message.from}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      to {message.to}
                    </div>
                  </div>
                </div>
                <div className="text-muted-foreground text-xs">
                  {formatDate(message.date)}
                </div>
              </div>

              <MessageBody
                messageId={message.id}
                bodyS3Key={message.bodyS3Key}
                snippet={message.snippet}
                className="mb-4"
              />

              {message.attachments.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <div className="text-muted-foreground mb-2 text-xs">
                    {message.attachments.length} attachment
                    {message.attachments.length > 1 ? "s" : ""}
                  </div>
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="border-border bg-muted/30 flex items-center gap-2 rounded border p-2"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span className="flex-1 text-sm">
                        {attachment.filename}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {attachment.size} bytes
                      </span>
                      <AttachmentDownload
                        attachmentId={attachment.id}
                        filename={attachment.filename}
                        size={attachment.size}
                      />
                    </div>
                  ))}
                </div>
              )}

              {index === threadData.messages.length - 1 && (
                <div className="border-border mt-4 flex items-center gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReply(false)}
                    disabled={isReplying || !replyText.trim()}
                  >
                    <Reply className="mr-1 h-3 w-3" />
                    Reply
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onForward(message.id.toString())}
                  >
                    <Forward className="mr-1 h-3 w-3" />
                    Forward
                  </Button>
                </div>
              )}
            </div>
          ))}

          {/* Render optimistic messages */}
          {optimisticMessages.map((message) => (
            <div
              key={`optimistic-${message.id}`}
              className={`border-border rounded-lg border p-4 ${
                message.isSending
                  ? "bg-blue-50 border-blue-200"
                  : message.isSent
                  ? "bg-green-50 border-green-200"
                  : ""
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {getInitials(message.from)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium">
                      {message.from}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      to {message.to}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-muted-foreground text-xs">
                    {formatDate(message.date)}
                  </div>
                  {message.isSending && (
                    <div className="flex items-center gap-1 text-blue-600 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Sending...</span>
                    </div>
                  )}
                  {message.isSent && !message.isSending && (
                    <div className="flex items-center gap-1 text-green-600 text-xs">
                      <span>✓ Sent</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 text-sm whitespace-pre-wrap">
                {message.sentBody || message.snippet}
              </div>
            </div>
          ))}

          {/* Reply Box */}
          <div className="border-border rounded-lg border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback>You</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">
                Reply to thread
              </span>
            </div>

            <Textarea
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              className="mb-3 min-h-[120px]"
              disabled={isReplying}
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => onReply(false)}
                  disabled={isReplying || !replyText.trim()}
                >
                  {isReplying ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  {isReplying ? 'Sending...' : 'Send'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDraftWithAI}
                  disabled={isDraftingWithAI || isReplying}
                >
                  {isDraftingWithAI ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1 h-3 w-3" />
                  )}
                  {isDraftingWithAI ? 'Generating...' : 'Draft with AI'}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                disabled={isReplying}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}