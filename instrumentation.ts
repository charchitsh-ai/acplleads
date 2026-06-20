export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const syncModule = await import('./utils/background-sync.js');
      const startBackgroundSync = syncModule.startBackgroundSync || (syncModule.default && syncModule.default.startBackgroundSync) || syncModule.default;
      if (typeof startBackgroundSync === 'function') {
        startBackgroundSync();
      } else {
        console.error('[Instrumentation] startBackgroundSync is not a function');
      }
    } catch (e) {
      console.error('[Instrumentation] Failed to start background sync:', e);
    }
  }
}
