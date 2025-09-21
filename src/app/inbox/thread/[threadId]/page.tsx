"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ThreadView, ForwardModal } from "~/components/gmail";
import { api } from "~/trpc/react";

export default function ThreadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const threadId = parseInt(params?.threadId as string);

  // Thread state
  const [replyText, setReplyText] = useState("");
  const hasMarkedAsRead = useRef(false);

  // Forward modal state
  const [isForwarding, setIsForwarding] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardBody, setForwardBody] = useState("");

  // API Queries
  const { data: threadMessages, isLoading: messagesLoading, refetch: refetchThreadMessages } =
    api.gmail.getThreadMessages.useQuery(
      { threadId },
      {
        enabled: !!threadId,
        refetchOnWindowFocus: false,
        staleTime: 0, // Always consider data stale
        gcTime: 0  // Don't cache
      }
    );

  const { refetch: refetchThreads } = api.gmail.getThreads.useInfiniteQuery(
    {
      limit: 20,
      label: 'INBOX',
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { refetch: refetchThreadCounts } = api.gmail.getThreadCounts.useQuery();

  const utils = api.useUtils();

  // Mutations
  const replyMutation = api.gmail.replyToMessage.useMutation({
    onSuccess: async (result) => {
      console.log('Reply sent and sync completed:', result);

      // Since backend sync is complete, just invalidate and refetch
      try {
        console.log('Invalidating caches and refetching...');

        // Invalidate all relevant caches (both tRPC and Redis should already be cleared by backend)
        await utils.gmail.getThreadMessages.invalidate({ threadId });
        await utils.gmail.getThreads.invalidate();

        console.log('tRPC caches invalidated');

        // Refetch the data with cache bypass
        console.log('Refetching with cache bypass...');
        const freshData = await utils.gmail.getThreadMessages.fetch({
          threadId,
          bypassCache: true
        });
        console.log('Fresh data from database:', freshData);

        await refetchThreadMessages();
        await refetchThreads();

        // Debug: Check what's actually in the database
        try {
          const debugData = await utils.gmail.debugThreadData.fetch({ threadId });
          console.log('Debug - Database content:', debugData);
        } catch (error) {
          console.error('Debug query failed:', error);
        }

        console.log('Refetch completed, clearing reply text');
        setReplyText("");
      } catch (error) {
        console.error('Failed to refetch after reply:', error);
        // Still clear reply text even if refetch fails
        setReplyText("");
      }
    },
    onError: (error) => {
      console.error('Failed to send reply:', error);
      // Don't clear reply text on error so user can retry
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
      refetchThreads();
      refetchThreadCounts();
    },
    onError: (error) => {
      console.error('Failed to mark thread as read:', error);
      refetchThreads();
      refetchThreadCounts();
    },
  });

  // Reset the read status flag when threadId changes
  useEffect(() => {
    hasMarkedAsRead.current = false;
  }, [threadId]);

  // Mark thread as read when opened (only once per thread)
  useEffect(() => {
    if (threadMessages && typeof threadMessages === 'object' && 'thread' in threadMessages && threadMessages.thread && typeof threadMessages.thread === 'object' && 'isUnread' in threadMessages.thread && threadMessages.thread.isUnread && !hasMarkedAsRead.current) {
      hasMarkedAsRead.current = true;
      markThreadReadMutation.mutate({ threadId });
    }
  }, [threadMessages, threadId]);

  const handleBack = () => {
    router.push('/inbox');
  };

  const handleReply = (replyAll: boolean = false) => {
    if (!threadMessages || typeof threadMessages !== 'object' || !('messages' in threadMessages) || !Array.isArray(threadMessages.messages) || !threadMessages.messages.length || !replyText.trim()) {
      return;
    }

    const lastMessage = threadMessages.messages[threadMessages.messages.length - 1];
    const sentText = replyText;

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

  // AI draft mutation
  const aiDraftMutation = api.gmail.generateAIDraft.useMutation({
    onSuccess: (data) => {
      setReplyText(data.draft);
    },
    onError: (error) => {
      console.error('Failed to generate AI draft:', error);
      // Fallback to static text if AI fails
      setReplyText(
        "Hi there,\n\nThank you for your message. I'll review the details and get back to you shortly.\n\nBest regards,",
      );
    },
  });

  const handleDraftWithAI = () => {
    aiDraftMutation.mutate({ threadId });
  };

  const handleCloseForward = () => {
    setIsForwarding(false);
    setForwardMessageId(null);
    setForwardTo("");
    setForwardBody("");
  };

  if (messagesLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div>Loading thread...</div>
      </div>
    );
  }

  if (!threadMessages || typeof threadMessages !== 'object' || !('messages' in threadMessages) || !Array.isArray(threadMessages.messages)) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div>Thread not found</div>
      </div>
    );
  }

  return (
    <>
      <ThreadView
        threadData={threadMessages as any}
        optimisticMessages={[]}
        replyText={replyText}
        onReplyTextChange={setReplyText}
        onBack={handleBack}
        onReply={handleReply}
        onForward={handleForward}
        onDraftWithAI={handleDraftWithAI}
        isReplying={replyMutation.isPending}
        isDraftingWithAI={aiDraftMutation.isPending}
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
    </>
  );
}