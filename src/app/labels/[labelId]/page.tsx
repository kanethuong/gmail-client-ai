"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { ThreadList } from "~/components/gmail";
import { api } from "~/trpc/react";

const LABEL_NAMES: Record<string, string> = {
  'STARRED': 'Starred',
  'IMPORTANT': 'Important',
  'UNREAD': 'Unread',
  'SENT': 'Sent',
  'DRAFT': 'Draft',
  'TRASH': 'Trash',
  'SPAM': 'Spam',
};

export default function LabelPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const labelId = params?.labelId as string;

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
      label: labelId,
      searchQuery: debouncedSearchQuery?.trim() || undefined,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: !!labelId,
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

  const labelName = labelId && LABEL_NAMES[labelId] ? LABEL_NAMES[labelId] : labelId;

  if (threadsLoading && allThreads.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1">
        <div>Loading {labelName?.toLowerCase() || 'unknown'} threads...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      {/* <div className="border-border border-b p-4">
        <h1 className="text-lg font-semibold">{labelName}</h1>
      </div> */}

      {/* Thread List */}
      <div className="flex-1">
        <ThreadList
          threads={allThreads}
          selectedLabel={labelId}
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
      </div>
    </div>
  );
}