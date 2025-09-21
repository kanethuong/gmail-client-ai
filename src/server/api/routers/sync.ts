import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { GmailSyncService } from "~/lib/gmail-sync";
import { cronScheduler } from "~/lib/cron-scheduler";
import { db } from "~/server/db";
import { users, syncLogs } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";

// Initialize scheduled sync on server startup
import "~/lib/init-scheduler";

export const syncRouter = createTRPCRouter({
  /**
   * Trigger a full sync for the authenticated user
   */
  triggerSync: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      // Get user's OAuth tokens
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        throw new Error("User not found");
      }

      const userData = user[0]!;
      if (!userData.oauthAccessToken || !userData.oauthRefreshToken) {
        throw new Error("User OAuth tokens not found");
      }

      // Create sync service and start sync
      const syncService = new GmailSyncService(
        userData.oauthAccessToken,
        userData.oauthRefreshToken
      );

      const result = await syncService.syncUser(userId);
      
      return {
        success: result.success,
        threadsSynced: result.threadsSynced,
        messagesSynced: result.messagesSynced,
        attachmentsSynced: result.attachmentsSynced,
        error: result.error,
      };
    }),

  /**
   * Get sync status and history for the authenticated user
   */
  getSyncStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      // Get user's last sync time
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const lastSyncAt = user[0]?.lastSyncAt;

      // Get recent sync logs
      const recentSyncs = await db.select()
        .from(syncLogs)
        .where(eq(syncLogs.userId, userId))
        .orderBy(desc(syncLogs.startedAt))
        .limit(10);

      return {
        lastSyncAt,
        recentSyncs: recentSyncs.map(sync => ({
          id: sync.id,
          syncType: sync.syncType,
          startedAt: sync.startedAt,
          completedAt: sync.completedAt,
          status: sync.status,
          threadsSynced: sync.threadsSynced,
          messagesSynced: sync.messagesSynced,
          errorMessage: sync.errorMessage,
        })),
      };
    }),

  /**
   * Get sync progress for a running sync
   */
  getSyncProgress: protectedProcedure
    .input(z.object({ syncLogId: z.number() }))
    .query(async ({ input }) => {
      const syncLog = await db.select()
        .from(syncLogs)
        .where(eq(syncLogs.id, input.syncLogId))
        .limit(1);

      if (!syncLog.length) {
        throw new Error("Sync log not found");
      }

      return {
        id: syncLog[0]?.id,
        status: syncLog[0]?.status,
        startedAt: syncLog[0]?.startedAt,
        completedAt: syncLog[0]?.completedAt,
        threadsSynced: syncLog[0]?.threadsSynced,
        messagesSynced: syncLog[0]?.messagesSynced,
        errorMessage: syncLog[0]?.errorMessage,
      };
    }),

  /**
   * Cancel a running sync (if possible)
   */
  cancelSync: protectedProcedure
    .input(z.object({ syncLogId: z.number() }))
    .mutation(async ({ input }) => {
      // Update sync log to cancelled status
      await db.update(syncLogs)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
        })
        .where(eq(syncLogs.id, input.syncLogId));

      return { success: true };
    }),

  /**
   * Get user's Gmail account info
   */
  getAccountInfo: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        throw new Error("User not found");
      }

      const userData = user[0];
      
      return {
        email: userData?.email,
        name: userData?.name,
        lastSyncAt: userData?.lastSyncAt,
        hasOAuthTokens: !!(userData?.oauthAccessToken && userData?.oauthRefreshToken),
      };
    }),

  /**
   * Get scheduled sync status
   */
  getScheduledSyncStatus: protectedProcedure
    .query(async () => {
      const tasksStatus = cronScheduler.getTasksStatus();

      return {
        enabled: process.env.SCHEDULED_SYNC_ENABLED !== 'false',
        cronSchedule: process.env.SYNC_CRON_SCHEDULE || '*/30 * * * *',
        intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || "30"),
        isRunning: tasksStatus['scheduled-sync'] || false,
      };
    }),

  /**
   * Trigger manual scheduled sync
   */
  triggerScheduledSync: protectedProcedure
    .mutation(async () => {
      try {
        await cronScheduler.triggerManualSync();

        return {
          success: true,
          message: "Manual scheduled sync triggered successfully",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        throw new Error(
          `Failed to trigger scheduled sync: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
});
