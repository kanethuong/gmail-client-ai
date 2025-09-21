"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import {
  RefreshCw,
  LogOut,
  Inbox,
  Star,
  AlertCircle,
  Mail,
  Send,
  FileText,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { SearchBar } from "~/components/gmail";
import { handleSignOut } from "~/lib/auth";
import { api } from "~/trpc/react";

// Predefined Gmail labels with icons and mapping
const PREDEFINED_LABELS = [
  {
    id: 'inbox',
    name: 'Inbox',
    icon: Inbox,
    gmailLabelId: 'INBOX',
    href: '/inbox',
  },
  {
    id: 'starred',
    name: 'Starred',
    icon: Star,
    gmailLabelId: 'STARRED',
    href: '/labels/STARRED',
  },
  {
    id: 'important',
    name: 'Important',
    icon: AlertCircle,
    gmailLabelId: 'IMPORTANT',
    href: '/labels/IMPORTANT',
  },
  {
    id: 'unread',
    name: 'Unread',
    icon: Mail,
    gmailLabelId: 'UNREAD',
    href: '/labels/UNREAD',
  },
  {
    id: 'sent',
    name: 'Sent',
    icon: Send,
    gmailLabelId: 'SENT',
    href: '/labels/SENT',
  },
  {
    id: 'draft',
    name: 'Draft',
    icon: FileText,
    gmailLabelId: 'DRAFT',
    href: '/labels/DRAFT',
  },
];

interface InboxLayoutProps {
  children: React.ReactNode;
}

export default function InboxLayout({ children }: InboxLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [searchQuery, setSearchQuery] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  // API Queries
  const { data: threadCounts, isLoading: countsLoading, refetch: refetchThreadCounts } =
    api.gmail.getThreadCounts.useQuery();

  // Mutations
  const triggerSyncMutation = api.sync.triggerSync.useMutation({
    onSuccess: () => {
      refetchThreadCounts();
    },
  });

  const handleSync = () => {
    triggerSyncMutation.mutate();
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/inbox?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/inbox');
    }
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
              className="w-full"
              onClick={() => router.push('/inbox/compose')}
            >
              Compose
            </Button>

            <div className="space-y-1">
              {PREDEFINED_LABELS.map((label) => {
                const IconComponent = label.icon;
                const labelCount = threadCounts?.find((c) => c.labelId === label.gmailLabelId)?.count || 0;
                const isActive = pathname === label.href ||
                  (pathname && pathname.startsWith('/labels/') && pathname.includes(label.gmailLabelId));

                return (
                  <div
                    key={label.id}
                    onClick={() => router.push(label.href)}
                    className={`hover:bg-accent flex cursor-pointer items-center justify-between rounded p-2 ${
                      isActive ? "bg-accent" : ""
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
            <SearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onSearch={handleSearch}
              isSearching={false}
            />

            <div className="flex items-center gap-2">
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

        {/* Page Content */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}