"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Search,
  Menu,
  Settings,
  Archive,
  Trash2,
  Star,
  Reply,
  ReplyAll,
  Forward,
  Download,
  Paperclip,
  Send,
  Sparkles,
  RefreshCw,
  Loader2,
  LogOut,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Textarea } from "~/components/ui/textarea";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { SyncPanel } from "~/components/SyncPanel";
import { MessageBody } from "~/components/MessageBody";
import { AttachmentDownload } from "~/components/AttachmentDownload";
import { handleSignOut } from "~/lib/auth";
import { api } from "~/trpc/react";

export default function GmailClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);

  // Compose form state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Forward modal state
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardBody, setForwardBody] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // Fetch Gmail data with infinite scroll
  const {
    data: threadsPages,
    isLoading: threadsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchThreads,
  } = api.gmail.getThreads.useInfiniteQuery(
    {
      limit: 20,
      label: selectedLabel,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Flatten threads from all pages
  const allThreads = threadsPages?.pages.flatMap(page => page.threads) ?? [];

  // Infinite scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Load more when scrolled to within 100px of bottom
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const { data: labelsData, isLoading: labelsLoading } =
    api.gmail.getLabels.useQuery();
  const { data: threadCounts, isLoading: countsLoading } =
    api.gmail.getThreadCounts.useQuery();

  const { data: threadMessages, isLoading: messagesLoading } =
    api.gmail.getThreadMessages.useQuery(
      { threadId: selectedThread! },
      { enabled: !!selectedThread },
    );

  // Sync functionality
  const triggerSyncMutation = api.sync.triggerSync.useMutation({
    onSuccess: () => {
      refetchThreads();
      setShowSyncPanel(false);
    },
  });

  // Email mutations
  const sendEmailMutation = api.gmail.sendEmail.useMutation({
    onSuccess: () => {
      setIsComposing(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      refetchThreads();
    },
  });

  const replyMutation = api.gmail.replyToMessage.useMutation({
    onSuccess: () => {
      setReplyText("");
      refetchThreads();
    },
  });

  const forwardMutation = api.gmail.forwardMessage.useMutation({
    onSuccess: () => {
      setIsForwarding(false);
      setForwardMessageId(null);
      setForwardTo("");
      setForwardBody("");
      refetchThreads();
    },
  });

  const handleSyncEmails = () => {
    triggerSyncMutation.mutate();
  };

  const handleSendEmail = () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      return;
    }

    console.log('Frontend sending email with body:', composeBody);
    console.log('Body length:', composeBody.length);

    sendEmailMutation.mutate({
      to: composeTo.split(',').map(email => email.trim()),
      subject: composeSubject,
      body: composeBody,
      isHtml: true,
    });
  };

  const handleReply = (replyAll: boolean = false) => {
    if (!selectedThread || !threadMessages?.messages.length || !replyText.trim()) {
      return;
    }

    const lastMessage = threadMessages.messages[threadMessages.messages.length - 1];
    const sentText = replyText;

    // Immediately add optimistic message for demo
    const optimisticMessage = {
      id: Date.now(), // Temporary ID
      gmailMessageId: `temp-${Date.now()}`,
      from: session?.user?.email || 'me',
      to: lastMessage!.from,
      cc: '',
      bcc: '',
      subject: `Re: ${lastMessage!.subject}`,
      date: new Date(),
      snippet: sentText.substring(0, 100),
      bodyS3Key: '',
      isUnread: false,
      isStarred: false,
      isDraft: false,
      createdAt: new Date(),
      attachments: [],
      threadId: selectedThread,
      isOptimistic: true,
      sentBody: sentText,
    };

    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setReplyText("");

    console.log('Frontend sending reply with body:', sentText);
    console.log('Reply body length:', sentText.length);

    replyMutation.mutate({
      messageId: lastMessage!.id.toString(),
      body: sentText,
      replyAll,
    });
  };

  const handleForward = (messageId: string) => {
    setForwardMessageId(messageId);
    setIsForwarding(true);
  };

  const handleSendForward = () => {
    if (!forwardMessageId || !forwardTo.trim()) {
      return;
    }

    forwardMutation.mutate({
      messageId: forwardMessageId,
      to: forwardTo.split(',').map(email => email.trim()),
      body: forwardBody,
    });
  };

  const handleDraftWithAI = () => {
    setReplyText(
      "Hi there,\n\nThank you for your message. I'll review the details and get back to you shortly.\n\nBest regards,",
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffInHours < 24 * 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Show loading state
  if (status === "loading" || threadsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading Gmail...</span>
        </div>
      </div>
    );
  }

  // Show error if not authenticated
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="bg-background flex h-screen">
      {/* Sidebar */}
      <div className="border-border bg-card w-64 border-r">
        <div className="p-4">
          <div className="mb-6 flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <span className="text-primary-foreground text-sm font-bold">
                G
              </span>
            </div>
            <span className="text-lg font-semibold">Gmail</span>
          </div>

          <Button
            onClick={handleSyncEmails}
            className="mb-4 w-full bg-transparent"
            variant="outline"
            disabled={triggerSyncMutation.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {triggerSyncMutation.isPending ? "Syncing..." : "Sync Emails"}
          </Button>

          <Button onClick={() => setIsComposing(true)} className="mb-6 w-full">
            Compose
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-4 pb-4">
            {/* Gmail labels */}
            {labelsData?.map((label) => (
              <div
                key={label.id}
                className={`hover:bg-accent flex cursor-pointer items-center justify-between rounded-lg p-2 ${
                  selectedLabel === label.labelId
                    ? "bg-accent text-accent-foreground"
                    : ""
                }`}
                onClick={() => {
                  setSelectedLabel(label.labelId);
                  setSelectedThread(null); // Close thread view when changing labels
                  setOptimisticMessages([]); // Clear optimistic messages
                }}
              >
                <span className="text-sm">{label.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {threadCounts?.find((c) => c.labelId === label.labelId)
                    ?.count || 0}
                </Badge>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-border border-b p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="max-w-2xl flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
                <Input
                  placeholder="Search mail"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1">
          {/* Thread List */}
          {!selectedThread && (
            <div className="border-border flex-1 border-r">
              <div className="border-border border-b p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {selectedLabel
                      ? labelsData?.find((l) => l.labelId === selectedLabel)
                          ?.name || selectedLabel
                      : "Inbox"}
                  </h2>
                  <Badge variant="secondary">
                    {allThreads.filter((t) => t.isUnread).length} unread
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1" onScrollCapture={handleScroll}>
                {allThreads.map((thread, index) => (
                  <div
                    key={`${thread.id}-${thread.gmailThreadId}-${index}`}
                    onClick={() => {
                      setSelectedThread(thread.id);
                      setOptimisticMessages([]); // Clear optimistic messages when switching threads
                    }}
                    className={`border-border hover:bg-accent cursor-pointer border-b p-4 ${
                      thread.isUnread ? "bg-muted/30" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2">
                        {thread.isStarred && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                        <div
                          className={`h-2 w-2 rounded-full ${thread.isUnread ? "bg-primary" : "bg-transparent"}`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span
                            className={`truncate text-sm ${thread.isUnread ? "font-semibold" : ""}`}
                          >
                            {thread.latestMessage?.from || "Unknown"}
                          </span>
                          <div className="text-muted-foreground flex items-center gap-2 text-xs">
                            <span>{formatDate(thread.lastMessageDate)}</span>
                          </div>
                        </div>

                        <div
                          className={`mb-1 text-sm ${thread.isUnread ? "font-medium" : ""}`}
                        >
                          {thread.latestMessage?.subject || thread.snippet}
                        </div>

                        <div className="text-muted-foreground truncate text-xs">
                          {thread.snippet}
                        </div>

                        {thread.messageCount > 1 && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            {thread.messageCount} messages
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator for infinite scroll */}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Loading more threads...
                    </span>
                  </div>
                )}

                {/* End of list indicator */}
                {!hasNextPage && allThreads.length > 0 && (
                  <div className="flex items-center justify-center p-4">
                    <span className="text-sm text-muted-foreground">
                      All threads loaded ({allThreads.length} total)
                    </span>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {/* Thread View */}
          {selectedThread && threadMessages && (
            <div className="flex flex-1 flex-col">
              <div className="border-border border-b p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedThread(null);
                        setOptimisticMessages([]); // Clear optimistic messages
                      }}
                    >
                      ←
                    </Button>
                    <h2 className="font-semibold">
                      {threadMessages.thread?.snippet || "Thread"}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Star className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-6 p-4">
                  {/* Render actual messages */}
                  {threadMessages.messages.map((message, index) => (
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

                      {index === threadMessages.messages.length - 1 && (
                        <div className="border-border mt-4 flex items-center gap-2 border-t pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReply(false)}
                            disabled={replyMutation.isPending || !replyText.trim()}
                          >
                            <Reply className="mr-1 h-3 w-3" />
                            Reply
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReply(true)}
                            disabled={replyMutation.isPending || !replyText.trim()}
                          >
                            <ReplyAll className="mr-1 h-3 w-3" />
                            Reply All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleForward(message.id.toString())}
                          >
                            <Forward className="mr-1 h-3 w-3" />
                            Forward
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Render optimistic messages */}
                  {optimisticMessages
                    .filter(msg => msg.threadId === selectedThread)
                    .map((message) => (
                    <div
                      key={`optimistic-${message.id}`}
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
                      onChange={(e) => setReplyText(e.target.value)}
                      className="mb-3 min-h-[120px]"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleReply(false)}
                          disabled={replyMutation.isPending || !replyText.trim()}
                        >
                          {replyMutation.isPending ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3 w-3" />
                          )}
                          {replyMutation.isPending ? 'Sending...' : 'Send'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDraftWithAI}
                        >
                          <Sparkles className="mr-1 h-3 w-3" />
                          Draft with AI
                        </Button>
                      </div>

                      <Button variant="ghost" size="icon">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Sync Panel Modal */}
      {showSyncPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border-border flex max-h-[80vh] w-full max-w-4xl flex-col rounded-lg border">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">Gmail Sync</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSyncPanel(false)}
              >
                ×
              </Button>
            </div>
            <div className="overflow-auto p-6">
              <SyncPanel />
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {isComposing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border-border flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">New Message</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsComposing(false)}
              >
                ×
              </Button>
            </div>

            <div className="space-y-3 p-4">
              <Input
                placeholder="To (comma-separated emails)"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
              <Textarea
                placeholder="Compose your message..."
                className="min-h-[200px]"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>

            <div className="border-border flex items-center justify-between border-t p-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSendEmail}
                  disabled={sendEmailMutation.isPending || !composeTo.trim() || !composeSubject.trim() || !composeBody.trim()}
                >
                  {sendEmailMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  {sendEmailMutation.isPending ? 'Sending...' : 'Send'}
                </Button>
                <Button variant="outline" onClick={handleDraftWithAI}>
                  <Sparkles className="mr-1 h-3 w-3" />
                  Draft with AI
                </Button>
              </div>

              <Button variant="ghost" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Modal */}
      {isForwarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border-border flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border">
            <div className="border-border flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">Forward Message</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsForwarding(false);
                  setForwardMessageId(null);
                  setForwardTo("");
                  setForwardBody("");
                }}
              >
                ×
              </Button>
            </div>

            <div className="space-y-3 p-4">
              <Input
                placeholder="To (comma-separated emails)"
                value={forwardTo}
                onChange={(e) => setForwardTo(e.target.value)}
              />
              <Textarea
                placeholder="Add your message (optional)..."
                className="min-h-[120px]"
                value={forwardBody}
                onChange={(e) => setForwardBody(e.target.value)}
              />
            </div>

            <div className="border-border flex items-center justify-between border-t p-4">
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSendForward}
                  disabled={forwardMutation.isPending || !forwardTo.trim()}
                >
                  {forwardMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  {forwardMutation.isPending ? 'Forwarding...' : 'Forward'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsForwarding(false);
                    setForwardMessageId(null);
                    setForwardTo("");
                    setForwardBody("");
                  }}
                >
                  Cancel
                </Button>
              </div>

              <Button variant="ghost" size="icon">
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
