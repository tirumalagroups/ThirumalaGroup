import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/offlineQueueDB';
import { supabaseDB } from '../lib/supabaseDatabase';
import { syncAllMasterData } from '../lib/offlineMasterData';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  offlineSince: string | null;
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (val: boolean) => void;
  triggerSync: () => Promise<void>;
  updateStats: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem('last_sync_at'));
  const [offlineSince, setOfflineSince] = useState<string | null>(() => localStorage.getItem('offline_since'));
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('auto_sync_enabled');
    return saved !== 'false'; // Default to true
  });

  const setAutoSyncEnabled = (val: boolean) => {
    setAutoSyncEnabledState(val);
    localStorage.setItem('auto_sync_enabled', String(val));
  };

  const updateStats = async () => {
    try {
      const count = await db.queued_operations
        .where('status')
        .equals('pending_sync')
        .count();
      setPendingCount(count);
      
      const lastSync = localStorage.getItem('last_sync_at');
      setLastSyncAt(lastSync);
      
      const offlineTime = localStorage.getItem('offline_since');
      setOfflineSince(offlineTime);
    } catch (err) {
      console.error('Failed to update offline stats:', err);
    }
  };

  const triggerSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    supabaseDB.isSyncing = true;
    try {
      console.log('🔄 Triggering background offline queue sync...');
      await supabaseDB.syncOfflineQueue();
      
      const now = new Date().toISOString();
      localStorage.setItem('last_sync_at', now);
      setLastSyncAt(now);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
      supabaseDB.isSyncing = false;
      await updateStats();
    }
  };

  // Run retention cleanup for records older than 7 days
  const cleanUpRetentionHistory = async () => {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isoThreshold = sevenDaysAgo.toISOString();
      const count = await db.queued_operations
        .where('synced_at')
        .below(isoThreshold)
        .delete();
      if (count > 0) {
        console.log(`🧹 Cleaned up ${count} synced operation logs older than 7 days.`);
      }
    } catch (err) {
      console.error('Failed to clean up sync retention history:', err);
    }
  };

  useEffect(() => {
    // Sync class instance properties to react states
    supabaseDB.isOnline = navigator.onLine;

    const handleOnline = () => {
      setIsOnline(true);
      supabaseDB.isOnline = true;
      localStorage.removeItem('offline_since');
      setOfflineSince(null);
      
      // Auto sync if enabled
      if (autoSyncEnabled) {
        triggerSync();
      } else {
        updateStats();
      }

      // Sync master data cache
      syncAllMasterData().catch(err => console.error('Error syncing master data cache:', err));
    };

    const handleOffline = () => {
      setIsOnline(false);
      supabaseDB.isOnline = false;
      const now = new Date().toISOString();
      localStorage.setItem('offline_since', now);
      setOfflineSince(now);
      updateStats();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial operations
    updateStats();
    cleanUpRetentionHistory();
    if (navigator.onLine) {
      syncAllMasterData().catch(err => console.error('Error syncing master data cache:', err));
    }

    const handleQueueChange = () => {
      updateStats();
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);

    // Periodically sync stats just in case
    const interval = setInterval(updateStats, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      clearInterval(interval);
    };
  }, [autoSyncEnabled]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        lastSyncAt,
        offlineSince,
        autoSyncEnabled,
        setAutoSyncEnabled,
        triggerSync,
        updateStats
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
