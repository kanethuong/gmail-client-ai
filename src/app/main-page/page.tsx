"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Settings,
  RefreshCw,
  LogOut,
  Inbox,
  Star,
  AlertCircle,
  Mail,
  Send,
  FileText,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { handleSignOut } from "~/lib/auth";
import { api } from "~/trpc/react";
import {
  SearchBar,
  ThreadList,
  ThreadView,
  ComposeModal,
  ForwardModal,
} from "~/components/gmail";

// Predefined Gmail labels with icons and mapping
const PREDEFINED_LABELS = [
  {
    id: 'inbox',
    name: 'Inbox',
    icon: Inbox,
    gmailLabelId: 'INBOX',
  },
  {
    id: 'starred',
    name: 'Starred',
    icon: Star,
    gmailLabelId: 'STARRED',
  },
  {
    id: 'important',
    name: 'Important',
    icon: AlertCircle,
    gmailLabelId: 'IMPORTANT',
  },
  {
    id: 'unread',
    name: 'Unread',
    icon: Mail,
    gmailLabelId: 'UNREAD',
  },
  {
    id: 'sent',
    name: 'Sent',
    icon: Send,
    gmailLabelId: 'SENT',
  },
  {
    id: 'draft',
    name: 'Draft',
    icon: FileText,
    gmailLabelId: 'DRAFT',
  },
];

export default function GmailClient() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Main app state
  const [selectedThread, setSelectedThread] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();
  const [optimisticMessages, setOptimisticMessages] = useState<any[]>([]);

  // Compose modal state
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  // Reply state
  const [replyText, setReplyText] = useState("");

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

  // API Queries
  const {
    data: threadsPages,
    isLoading: threadsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchThreads,
  } = api.gmail.getThreads.useInfiniteQuery(
    ({ pageParam = 0 }) => ({
      limit: 20,
      cursor: pageParam as number,
      label: selectedLabel || undefined,
    }),
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { data: labelsData, isLoading: labelsLoading } =
    api.gmail.getLabels.useQuery();
  const { data: threadCounts, isLoading: countsLoading, refetch: refetchThreadCounts } =
    api.gmail.getThreadCounts.useQuery();

  const { data: threadMessages, isLoading: messagesLoading, refetch: refetchThreadMessages } =
    api.gmail.getThreadMessages.useQuery(
      { threadId: selectedThread! },
      { enabled: !!selectedThread },
    );

  // Mutations
  const triggerSyncMutation = api.sync.triggerSync.useMutation({
    onSuccess: () => {
      refetchThreads();
    },
  });

  const handleSync = () => {
    triggerSyncMutation.mutate();
  };

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
    onSuccess: async () => {
      setReplyText("");

      // Update optimistic message to show "Sent" status
      setOptimisticMessages(prev =>
        prev.map(msg => ({
          ...msg,
          isSending: false,
          isSent: true
        }))
      );

      // Refresh thread messages after a short delay
      try {
        await refetchThreadMessages();
        await refetchThreads();

        // Clear optimistic messages after successful refetch
        setTimeout(() => {
          setOptimisticMessages([]);
        }, 500); // Small delay to ensure refetch completes
      } catch (error) {
        console.error('Failed to refetch after reply:', error);
        // Keep optimistic message if refetch fails
      }
    },
    onError: (error) => {
      console.error('Failed to send reply:', error);
      // Remove optimistic message on error
      setOptimisticMessages([]);
      // Optionally show error to user
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

  const markThreadReadMutation = api.gmail.markThreadRead.useMutation({
    onSuccess: () => {
      // Refresh threads and thread counts to update unread counts and status
      refetchThreads();
      refetchThreadCounts();
    },
    onError: (error) => {
      console.error('Failed to mark thread as read:', error);
      // Optionally refresh to get correct state
      refetchThreads();
      refetchThreadCounts();
    },
  });

  // Flatten threads from all pages
  const allThreads = threadsPages?.pages.flatMap(page => page.threads) ?? [];


  // Event handlers

  const handleThreadSelect = (threadId: number) => {
    setSelectedThread(threadId);
    setOptimisticMessages([]);

    // Find the selected thread and check if it's unread
    const selectedThreadData = allThreads.find(t => t.id === threadId);

    // Only mark as read if the thread is currently unread
    if (selectedThreadData?.isUnread) {
      markThreadReadMutation.mutate({ threadId });
    }
  };

  const handleBackToList = () => {
    setSelectedThread(null);
    setOptimisticMessages([]);
  };

  const handleReply = (replyAll: boolean = false) => {
    if (!selectedThread || !threadMessages?.messages.length || !replyText.trim()) {
      return;
    }

    const lastMessage = threadMessages.messages[threadMessages.messages.length - 1];
    const sentText = replyText;

    replyMutation.mutate({
      messageId: lastMessage!.id.toString(),
      body: sentText,
      replyAll,
    });

    // Add optimistic message with sending status
    const optimisticMessage = {
      id: `temp-${Date.now()}`,
      from: session?.user?.email || "You",
      to: lastMessage!.from,
      date: new Date(),
      snippet: sentText,
      attachments: [],
      threadId: selectedThread,
      isOptimistic: true,
      isSending: true,
      sentBody: sentText,
    };

    setOptimisticMessages(prev => [...prev, optimisticMessage]);
    setReplyText("");
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

  const handleSendEmail = () => {
    if (!composeTo.trim() || !composeSubject.trim() || !composeBody.trim()) {
      return;
    }

    sendEmailMutation.mutate({
      to: composeTo.split(',').map(email => email.trim()),
      subject: composeSubject,
      body: composeBody,
    });
  };

  const handleDraftWithAI = () => {
    setReplyText(
      "Hi there,\n\nThank you for your message. I'll review the details and get back to you shortly.\n\nBest regards,",
    );
  };

  const handleCloseCompose = () => {
    setIsComposing(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
  };

  const handleCloseForward = () => {
    setIsForwarding(false);
    setForwardMessageId(null);
    setForwardTo("");
    setForwardBody("");
  };

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="bg-muted/10 border-border flex w-64 flex-col border-r">
        <div className="border-border border-b p-4">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 h-8 w-8 rounded"></div>
            <span className="font-semibold">Gmail Client</span>
          </div>
        </div>

        <div className="flex-1 p-4">
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSync}
              disabled={triggerSyncMutation.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${triggerSyncMutation.isPending ? 'animate-spin' : ''}`} />
              {triggerSyncMutation.isPending ? 'Syncing...' : 'Sync'}
            </Button>

            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => setIsComposing(true)}
            >
              Compose
            </Button>

            <div className="space-y-1">
              {PREDEFINED_LABELS.map((label) => {
                const IconComponent = label.icon;
                const labelCount = threadCounts?.find((c) => c.labelId === label.gmailLabelId)?.count || 0;

                return (
                  <div
                    key={label.id}
                    onClick={() => setSelectedLabel(label.gmailLabelId)}
                    className={`hover:bg-accent flex cursor-pointer items-center justify-between rounded p-2 ${
                      selectedLabel === label.gmailLabelId ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-4 w-4" />
                      <span className="text-sm">{label.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {labelCount}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-border border-b p-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>

            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSignOut()}
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-1">
          {!selectedThread ? (
            <ThreadList
              threads={allThreads}
              selectedLabel={selectedLabel}
              labelsData={labelsData}
              predefinedLabels={PREDEFINED_LABELS}
              onThreadSelect={handleThreadSelect}
              onScrollReachEnd={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
            />
          ) : (
            threadMessages && (
              <ThreadView
                threadData={threadMessages}
                optimisticMessages={optimisticMessages.filter(msg => msg.threadId === selectedThread)}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onBack={handleBackToList}
                onReply={handleReply}
                onForward={handleForward}
                onDraftWithAI={handleDraftWithAI}
                isReplying={replyMutation.isPending}
              />
            )
          )}
        </div>
      </div>

      {/* Modals */}

      <ComposeModal
        isOpen={isComposing}
        to={composeTo}
        subject={composeSubject}
        body={composeBody}
        onToChange={setComposeTo}
        onSubjectChange={setComposeSubject}
        onBodyChange={setComposeBody}
        onSend={handleSendEmail}
        onClose={handleCloseCompose}
        onDraftWithAI={handleDraftWithAI}
        isSending={sendEmailMutation.isPending}
      />

      <ForwardModal
        isOpen={isForwarding}
        to={forwardTo}
        body={forwardBody}
        onToChange={setForwardTo}
        onBodyChange={setForwardBody}
        onForward={handleSendForward}
        onClose={handleCloseForward}
        isForwarding={forwardMutation.isPending}
      />
    </div>
  );
}