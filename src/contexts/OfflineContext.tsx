import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/offlineQueueDB';
import { supabaseDB } from '../lib/supabaseDatabase';
import { syncAllMasterData } from '../lib/offlineMasterData';

export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'CHECKING' | 'BACKEND_ERROR';

interface OfflineContextType {
  isOnline: boolean;
  connectionStatus: ConnectionStatus;
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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CHECKING');
  const [isOnline, setIsOnline] = useState<boolean>(true); // Assume online during CHECKING to avoid UI block
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

  const checkConnectivity = async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      supabaseDB.isOnline = false;
      setConnectionStatus('OFFLINE');
      const now = new Date().toISOString();
      if (!localStorage.getItem('offline_since')) {
        localStorage.setItem('offline_since', now);
        setOfflineSince(now);
      }
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      // Probe current domain favicon (fast, same-origin, no CORS)
      await fetch(`${window.location.origin}/favicon.ico?_cb=${Date.now()}`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      setIsOnline(true);
      supabaseDB.isOnline = true;
      setConnectionStatus('ONLINE');
      localStorage.removeItem('offline_since');
      setOfflineSince(null);
    } catch (err: any) {
      console.warn('[Network] Primary connectivity probe failed:', err);

      // Fallback check to Google to distinguish between local origin down vs. no internet
      try {
        const googleController = new AbortController();
        const googleTimeoutId = setTimeout(() => googleController.abort(), 3500);

        await fetch('https://clients3.google.com/generate_204', {
          mode: 'no-cors',
          signal: googleController.signal,
          cache: 'no-store',
        });

        clearTimeout(googleTimeoutId);

        // Google probe succeeded - we are online! Local origin/backend is down or DNS issue
        setIsOnline(true);
        supabaseDB.isOnline = true;
        setConnectionStatus('BACKEND_ERROR');
      } catch (gErr) {
        console.warn('[Network] Fallback Google probe also failed:', gErr);
        // Both probes failed, genuinely offline
        setIsOnline(false);
        supabaseDB.isOnline = false;
        setConnectionStatus('OFFLINE');
        const now = new Date().toISOString();
        if (!localStorage.getItem('offline_since')) {
          localStorage.setItem('offline_since', now);
          setOfflineSince(now);
        }
      }
    }
  };

  useEffect(() => {
    // Initial run
    checkConnectivity();

    const handleOnline = () => {
      console.log('[Network] Browser online event received. Verifying actual internet...');
      checkConnectivity();
    };

    const handleOffline = () => {
      console.log('[Network] Browser offline event received.');
      setIsOnline(false);
      supabaseDB.isOnline = false;
      setConnectionStatus('OFFLINE');
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

    const handleQueueChange = () => {
      updateStats();
    };
    window.addEventListener('offline-queue-changed', handleQueueChange);

    // Periodically probe connectivity (every 10 seconds)
    const probeInterval = setInterval(() => {
      checkConnectivity();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-changed', handleQueueChange);
      clearInterval(probeInterval);
    };
  }, []);

  // Handle sync/master data load upon transitioning to ONLINE/BACKEND_ERROR
  useEffect(() => {
    if (connectionStatus === 'ONLINE' || connectionStatus === 'BACKEND_ERROR') {
      if (autoSyncEnabled) {
        triggerSync();
      } else {
        updateStats();
      }

      // Sync master data cache
      syncAllMasterData().catch(err => console.error('Error syncing master data cache:', err));
    }
  }, [connectionStatus, autoSyncEnabled]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        connectionStatus,
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
