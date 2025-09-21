import cron from 'node-cron';

class CronScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize scheduled sync cron job
   */
  public initializeScheduledSync() {
    const cronExpression = process.env.SYNC_CRON_SCHEDULE || '*/30 * * * *'; // Default: every 30 minutes
    const taskName = 'scheduled-sync';

    console.log(`[CronScheduler] Initializing scheduled sync with cron: ${cronExpression}`);

    // Stop existing task if running
    this.stopTask(taskName);

    // Create new scheduled task
    const task = cron.schedule(cronExpression, async () => {
      await this.executeScheduledSync();
    }, {
      scheduled: false, 
      timezone: 'UTC'
    });

    this.scheduledTasks.set(taskName, task);

    // Start the task
    task.start();
    console.log(`[CronScheduler] ✅ Scheduled sync started with cron: ${cronExpression}`);

    return task;
  }

  /**
   * Execute the scheduled sync by calling our API endpoint
   */
  private async executeScheduledSync() {
    try {
      console.log('[CronScheduler] Triggering scheduled sync...');

      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const cronSecret = process.env.CRON_SECRET;

      if (!cronSecret) {
        console.error('[CronScheduler] CRON_SECRET not configured');
        return;
      }

      const response = await fetch(`${baseUrl}/api/sync/scheduled`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[CronScheduler] ✅ Scheduled sync completed:', {
          totalUsers: result.totalUsers,
          successCount: result.successCount,
          errorCount: result.errorCount,
        });
      } else {
        const error = await response.text();
        console.error('[CronScheduler] ❌ Scheduled sync failed:', response.status, error);
      }

    } catch (error) {
      console.error('[CronScheduler] Error executing scheduled sync:', error);
    }
  }

  /**
   * Stop a scheduled task
   */
  public stopTask(taskName: string) {
    const task = this.scheduledTasks.get(taskName);
    if (task) {
      task.stop();
      task.destroy();
      this.scheduledTasks.delete(taskName);
      console.log(`[CronScheduler] Stopped task: ${taskName}`);
    }
  }

  /**
   * Stop all scheduled tasks
   */
  public stopAllTasks() {
    for (const [taskName, task] of this.scheduledTasks.entries()) {
      task.stop();
      task.destroy();
      console.log(`[CronScheduler] Stopped task: ${taskName}`);
    }
    this.scheduledTasks.clear();
  }

  /**
   * Get status of scheduled tasks
   */
  public getTasksStatus() {
    const status: Record<string, boolean> = {};
    for (const [taskName, task] of this.scheduledTasks.entries()) {
      status[taskName] = task.running || false;
    }
    return status;
  }

  /**
   * Manual trigger for testing
   */
  public async triggerManualSync() {
    console.log('[CronScheduler] Manual sync triggered');
    await this.executeScheduledSync();
  }
}

// Export singleton instance
export const cronScheduler = new CronScheduler();

// Export types for configuration
export interface SyncConfig {
  enabled: boolean;
  cronSchedule: string;
  intervalMinutes: number;
}