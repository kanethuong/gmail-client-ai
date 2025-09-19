import { Star, Loader2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";

interface Thread {
  id: number;
  gmailThreadId: string;
  snippet: string | null;
  isUnread: boolean;
  isStarred: boolean;
  lastMessageDate: Date;
  messageCount: number;
  latestMessage?: {
    from: string;
    subject: string;
  } | null;
}

interface Label {
  id: number;
  labelId: string;
  name: string;
}

interface PredefinedLabel {
  id: string;
  name: string;
  gmailLabelId: string;
}

interface ThreadListProps {
  threads: Thread[];
  selectedLabel?: string;
  labelsData?: Label[];
  predefinedLabels?: PredefinedLabel[];
  onThreadSelect: (threadId: number) => void;
  onScrollReachEnd?: () => void;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 1) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

export function ThreadList({
  threads,
  selectedLabel,
  labelsData,
  predefinedLabels,
  onThreadSelect,
  onScrollReachEnd,
  isFetchingNextPage = false,
  hasNextPage = false,
}: ThreadListProps) {
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Trigger load when user is within 200px of the bottom
    const threshold = 200;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - threshold;

    if (isNearBottom && hasNextPage && !isFetchingNextPage) {
      onScrollReachEnd?.();
    }
  };

  const getDisplayTitle = () => {
    if (selectedLabel) {
      // First try to find in predefined labels
      const predefinedLabel = predefinedLabels?.find((l) => l.gmailLabelId === selectedLabel);
      if (predefinedLabel) {
        return predefinedLabel.name;
      }
      // Fallback to labelsData for custom labels
      return labelsData?.find((l) => l.labelId === selectedLabel)?.name || selectedLabel;
    }
    return "Inbox";
  };

  return (
    <div className="border-border flex h-full flex-col border-r">
      <div className="border-border border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{getDisplayTitle()}</h2>
          <Badge variant="secondary">
            {threads.filter((t) => t.isUnread).length} unread
          </Badge>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {threads.length} threads • hasNext: {hasNextPage ? 'Yes' : 'No'} • fetching: {isFetchingNextPage ? 'Yes' : 'No'}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
        style={{ height: 'calc(100vh - 200px)' }}
      >
        {threads.map((thread, index) => (
          <div
            key={`${thread.id}-${thread.gmailThreadId}-${index}`}
            onClick={() => onThreadSelect(thread.id)}
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
                  className={`h-2 w-2 rounded-full ${
                    thread.isUnread ? "bg-primary" : "bg-transparent"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={`truncate text-sm ${
                      thread.isUnread ? "font-semibold" : ""
                    }`}
                  >
                    {thread.latestMessage?.from || "No sender"}
                  </span>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    <span>{formatDate(thread.lastMessageDate)}</span>
                  </div>
                </div>

                <div
                  className={`mb-1 text-sm ${
                    thread.isUnread ? "font-medium" : ""
                  }`}
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
        {!hasNextPage && threads.length > 0 && (
          <div className="flex items-center justify-center p-4">
            <span className="text-sm text-muted-foreground">
              All threads loaded ({threads.length} total)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}