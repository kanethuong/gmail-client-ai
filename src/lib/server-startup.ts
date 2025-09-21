import { cronScheduler } from './cron-scheduler';

class ServerStartup {
  private static initialized = false;

  /**
   * Initialize server-side services
   * Call this once when the server starts
   */
  static async initialize() {
    if (this.initialized) {
      console.log('[ServerStartup] Already initialized, skipping...');
      return;
    }

    console.log('[ServerStartup] Initializing server services...');

    try {
      // Initialize scheduled sync if enabled and not in Vercel production
      const syncEnabled = process.env.SCHEDULED_SYNC_ENABLED !== 'false';
      const isVercelProduction = process.env.VERCEL === '1' && process.env.NODE_ENV === 'production';

      if (syncEnabled && !isVercelProduction) {
        console.log('[ServerStartup] Starting scheduled sync...');
        cronScheduler.initializeScheduledSync();
      } else if (isVercelProduction) {
        console.log('[ServerStartup] Vercel production detected - using Vercel Cron Functions instead of node-cron');
      } else {
        console.log('[ServerStartup] Scheduled sync disabled via environment variable');
      }

      this.initialized = true;
      console.log('[ServerStartup] ✅ Server services initialized successfully');

    } catch (error) {
      console.error('[ServerStartup] ❌ Failed to initialize server services:', error);
      throw error;
    }
  }

  /**
   * Cleanup when server shuts down
   */
  static async cleanup() {
    console.log('[ServerStartup] Cleaning up server services...');

    try {
      cronScheduler.stopAllTasks();
      console.log('[ServerStartup] ✅ Server cleanup completed');
    } catch (error) {
      console.error('[ServerStartup] Error during cleanup:', error);
    }
  }

  /**
   * Get initialization status
   */
  static isInitialized() {
    return this.initialized;
  }
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    console.log('[ServerStartup] SIGTERM received, shutting down gracefully...');
    await ServerStartup.cleanup();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('[ServerStartup] SIGINT received, shutting down gracefully...');
    await ServerStartup.cleanup();
    process.exit(0);
  });
}

export { ServerStartup };