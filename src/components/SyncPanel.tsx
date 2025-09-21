"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

export function SyncPanel() {
  const [isSyncing, setIsSyncing] = useState(false);

  const syncStatusQuery = api.sync.getSyncStatus.useQuery();
  const accountInfoQuery = api.sync.getAccountInfo.useQuery();
  const scheduledSyncStatusQuery = api.sync.getScheduledSyncStatus.useQuery();
  
  const triggerSyncMutation = api.sync.triggerSync.useMutation({
    onMutate: () => {
      setIsSyncing(true);
    },
    onSuccess: () => {
      setIsSyncing(false);
      // Refetch sync status
      syncStatusQuery.refetch();
    },
    onError: () => {
      setIsSyncing(false);
    },
  });

  const triggerScheduledSyncMutation = api.sync.triggerScheduledSync.useMutation({
    onSuccess: () => {
      // Refetch status after manual trigger
      scheduledSyncStatusQuery.refetch();
      syncStatusQuery.refetch();
    },
  });

  const handleTriggerSync = () => {
    triggerSyncMutation.mutate();
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "running":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Gmail Sync</h2>
        
        {accountInfoQuery.data && (
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-2">Account Information</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Email:</span> {accountInfoQuery.data.email}
              </div>
              <div>
                <span className="font-medium">Name:</span> {accountInfoQuery.data.name}
              </div>
              <div>
                <span className="font-medium">Last Sync:</span> {formatDate(accountInfoQuery.data.lastSyncAt)}
              </div>
              <div>
                <span className="font-medium">OAuth Status:</span>{" "}
                <Badge className={accountInfoQuery.data.hasOAuthTokens ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {accountInfoQuery.data.hasOAuthTokens ? "Connected" : "Not Connected"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleTriggerSync}
            disabled={isSyncing || triggerSyncMutation.isPending}
            className="min-w-[120px]"
          >
            {isSyncing || triggerSyncMutation.isPending ? "Syncing..." : "Start Sync"}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => syncStatusQuery.refetch()}
            disabled={syncStatusQuery.isLoading}
          >
            Refresh Status
          </Button>
        </div>

        {triggerSyncMutation.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="font-semibold text-red-800">Sync Error</h4>
            <p className="text-red-700">{triggerSyncMutation.error.message}</p>
          </div>
        )}

        {triggerSyncMutation.data && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <h4 className="font-semibold text-green-800">Sync Complete</h4>
            <div className="text-green-700 space-y-1">
              <div>Threads synced: {triggerSyncMutation.data.threadsSynced}</div>
              <div>Messages synced: {triggerSyncMutation.data.messagesSynced}</div>
              <div>Attachments synced: {triggerSyncMutation.data.attachmentsSynced}</div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Scheduled Sync</h3>

        {scheduledSyncStatusQuery.data && (
          <div className="rounded-lg border p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Status:</span>
                <Badge className={scheduledSyncStatusQuery.data.enabled && scheduledSyncStatusQuery.data.isRunning ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                  {scheduledSyncStatusQuery.data.enabled ?
                    (scheduledSyncStatusQuery.data.isRunning ? "Running" : "Enabled")
                    : "Disabled"
                  }
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Schedule:</span> {scheduledSyncStatusQuery.data.cronSchedule}
                </div>
                <div>
                  <span className="font-medium">Interval:</span> Every {scheduledSyncStatusQuery.data.intervalMinutes} minutes
                </div>
              </div>

              {scheduledSyncStatusQuery.data.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerScheduledSyncMutation.mutate()}
                  disabled={triggerScheduledSyncMutation.isPending}
                  className="w-full"
                >
                  {triggerScheduledSyncMutation.isPending ? "Triggering..." : "Trigger Manual Sync"}
                </Button>
              )}

              {triggerScheduledSyncMutation.data && (
                <div className="rounded border border-green-200 bg-green-50 p-2">
                  <p className="text-green-700 text-sm">{triggerScheduledSyncMutation.data.message}</p>
                </div>
              )}

              {triggerScheduledSyncMutation.error && (
                <div className="rounded border border-red-200 bg-red-50 p-2">
                  <p className="text-red-700 text-sm">{triggerScheduledSyncMutation.error.message}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Sync History</h3>
        
        {syncStatusQuery.isLoading ? (
          <div className="text-center py-4">Loading sync history...</div>
        ) : syncStatusQuery.data?.recentSyncs.length === 0 ? (
          <div className="text-center py-4 text-gray-500">No sync history available</div>
        ) : (
          <div className="space-y-3">
            {syncStatusQuery.data?.recentSyncs.map((sync) => (
              <div key={sync.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(sync.status)}>
                      {sync.status}
                    </Badge>
                    <span className="text-sm font-medium">{sync.syncType} sync</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(sync.startedAt)}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Threads: {sync.threadsSynced}</div>
                  <div>Messages: {sync.messagesSynced}</div>
                  {sync.errorMessage && (
                    <div className="text-red-600">
                      Error: {sync.errorMessage}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
