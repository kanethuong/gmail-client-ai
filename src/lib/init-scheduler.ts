import { ServerStartup } from './server-startup';

// Initialize the scheduler only once when the module is imported
let initialized = false;

const initializeOnce = async () => {
  if (initialized) return;

  try {
    // Only initialize in server-side environment
    if (typeof window === 'undefined') {
      await ServerStartup.initialize();
      initialized = true;
    }
  } catch (error) {
    console.error('[InitScheduler] Failed to initialize:', error);
  }
};

// Auto-initialize when this module is imported
void initializeOnce();