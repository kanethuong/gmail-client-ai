import { type NextApiRequest, type NextApiResponse } from "next";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { GmailSyncService } from "~/lib/gmail-sync";
import { eq, lt } from "drizzle-orm";

// Environment variable to control sync schedule
const SYNC_INTERVAL_MINUTES = parseInt(process.env.SYNC_INTERVAL_MINUTES || "30");

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth check - support both Vercel Cron and manual calls
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['user-agent']?.includes('vercel-cron') ||
                      req.headers['x-vercel-cron'] === '1';

  // Allow Vercel Cron or valid authorization header
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log("[Scheduled Sync] Starting scheduled sync for all users");

    // Find users who need syncing (haven't synced recently)
    const syncThreshold = new Date(Date.now() - SYNC_INTERVAL_MINUTES * 60 * 1000);
    const usersToSync = await db.select({
      id: users.id,
      email: users.email,
      lastSyncAt: users.lastSyncAt,
      oauthAccessToken: users.oauthAccessToken,
      oauthRefreshToken: users.oauthRefreshToken,
    })
    .from(users)
    .where(
      eq(users.oauthAccessToken, users.oauthAccessToken) // Users with valid tokens
    );

    // Filter users who need syncing
    const usersNeedingSync = usersToSync.filter(user => {
      if (!user.oauthAccessToken || !user.oauthRefreshToken) {
        return false;
      }

      if (!user.lastSyncAt) {
        return true; // Never synced
      }

      return user.lastSyncAt < syncThreshold;
    });

    console.log(`[Scheduled Sync] Found ${usersNeedingSync.length} users needing sync`);

    const syncResults = [];
    let successCount = 0;
    let errorCount = 0;

    // Sync each user (process in batches to avoid overwhelming the system)
    for (const user of usersNeedingSync) {
      try {
        console.log(`[Scheduled Sync] Syncing user ${user.email} (ID: ${user.id})`);

        const syncService = new GmailSyncService(
          user.oauthAccessToken!,
          user.oauthRefreshToken!
        );

        const result = await syncService.syncUser(user.id);

        syncResults.push({
          userId: user.id,
          email: user.email,
          success: result.success,
          threadsSynced: result.threadsSynced,
          messagesSynced: result.messagesSynced,
          attachmentsSynced: result.attachmentsSynced,
        });

        if (result.success) {
          successCount++;
          console.log(`[Scheduled Sync] ✅ User ${user.email} synced successfully: ${result.threadsSynced} threads, ${result.messagesSynced} messages`);
        } else {
          errorCount++;
          console.error(`[Scheduled Sync] ❌ User ${user.email} sync failed: ${result.error}`);
        }

        // Add small delay between users to be respectful to Gmail API
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        errorCount++;
        console.error(`[Scheduled Sync] Error syncing user ${user.email}:`, error);

        syncResults.push({
          userId: user.id,
          email: user.email,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const summary = {
      totalUsers: usersNeedingSync.length,
      successCount,
      errorCount,
      syncResults,
      completedAt: new Date().toISOString(),
    };

    console.log(`[Scheduled Sync] Completed: ${successCount} successful, ${errorCount} failed`);

    return res.status(200).json({
      message: "Scheduled sync completed",
      ...summary,
    });

  } catch (error) {
    console.error("[Scheduled Sync] Critical error:", error);

    return res.status(500).json({
      error: "Scheduled sync failed",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}