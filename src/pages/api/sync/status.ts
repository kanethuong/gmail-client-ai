import { type NextApiRequest, type NextApiResponse } from "next";
import { cronScheduler } from "~/lib/cron-scheduler";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === "GET") {
      // Get sync status
      const tasksStatus = cronScheduler.getTasksStatus();

      return res.status(200).json({
        enabled: process.env.SCHEDULED_SYNC_ENABLED !== 'false',
        cronSchedule: process.env.SYNC_CRON_SCHEDULE || '*/30 * * * *',
        intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || "30"),
        tasks: tasksStatus,
      });

    } else if (req.method === "POST") {
      // Manual trigger
      await cronScheduler.triggerManualSync();

      return res.status(200).json({
        message: "Manual sync triggered successfully",
        timestamp: new Date().toISOString(),
      });

    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

  } catch (error) {
    console.error("Sync status API error:", error);

    return res.status(500).json({
      error: "Failed to get sync status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}