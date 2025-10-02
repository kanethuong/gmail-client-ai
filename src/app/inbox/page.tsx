"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ThreadList } from "~/components/gmail";
import { api } from "~/trpc/react";

export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchQuery = searchParams ? searchParams.get('search') || '' : '';

  // Debounce search query for real-time search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  // API Queries
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
      label: 'INBOX',
      searchQuery: debouncedSearchQuery?.trim() || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: true,
    }
  );

  const { data: labelsData, isLoading: labelsLoading } =
    api.gmail.getLabels.useQuery();

  // Flatten threads from all pages
  const allThreads = threadsPages?.pages.flatMap(page => page.threads) ?? [];

  // Predefined labels for display
  const PREDEFINED_LABELS = [
    {
      id: 'inbox',
      name: 'Inbox',
      gmailLabelId: 'INBOX',
    },
    {
      id: 'starred',
      name: 'Starred',
      gmailLabelId: 'STARRED',
    },
    {
      id: 'important',
      name: 'Important',
      gmailLabelId: 'IMPORTANT',
    },
    {
      id: 'unread',
      name: 'Unread',
      gmailLabelId: 'UNREAD',
    },
    {
      id: 'sent',
      name: 'Sent',
      gmailLabelId: 'SENT',
    },
    {
      id: 'draft',
      name: 'Draft',
      gmailLabelId: 'DRAFT',
    },
  ];

  const handleThreadSelect = (threadId: number) => {
    router.push(`/inbox/thread/${threadId}`);
  };

  if (threadsLoading && allThreads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div>Loading threads...</div>
      </div>
    );
  }

  return (
    <ThreadList
      threads={allThreads}
      selectedLabel="INBOX"
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
      searchQuery={debouncedSearchQuery}
    />
  );
}