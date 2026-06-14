import { db } from './offlineQueueDB';
import { supabase } from './supabase';

export interface OfflineMasterData {
  id: string; // e.g., "companies_regular" or "companies_itr_itr"
  table_name: string;
  mode: 'regular' | 'itr';
  records: any[];
  last_synced_at: string;
}

// Default payment modes fallback
const DEFAULT_PAYMENT_MODES = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank Transfer', label: 'Bank' },
  { value: 'Online', label: 'Double' }
];

/**
 * Fetch and cache master data for the given mode (regular or ITR)
 */
export async function fetchAndCacheMasterData(mode: 'regular' | 'itr'): Promise<void> {
  const isOnline = navigator.onLine;
  if (!isOnline) {
    console.warn(`[offlineMasterData] Device is offline, skipping caching for mode: ${mode}`);
    return;
  }

  const schema = mode === 'itr' ? 'itr' : 'regular';
  const last_synced_at = new Date().toISOString();

  // Helper mapping table name key to its online query
  const queries: Record<string, () => Promise<any[]>> = {
    companies: async () => {
      const { data, error } = await supabase.schema(schema).from('companies').select('*').order('company_name');
      if (error) throw error;
      // Filter out duplicate names
      const seen = new Set<string>();
      return (data || []).filter(c => {
        const name = c.company_name?.trim();
        if (!name || seen.has(name)) return false;
        seen.add(name);
        return true;
      });
    },
    company_main_accounts: async () => {
      const { data, error } = await supabase.schema(schema).from('company_main_accounts').select('*').order('acc_name');
      if (error) throw error;
      return data || [];
    },
    company_main_sub_acc: async () => {
      const { data, error } = await supabase.schema(schema).from('company_main_sub_acc').select('*').order('sub_acc');
      if (error) throw error;
      return data || [];
    },
    staff: async () => {
      const { data, error } = await supabase.schema(schema).from('cash_book').select('staff').not('staff', 'is', null).neq('staff', '').order('staff');
      if (error) throw error;
      const uniqueNames = Array.from(new Set((data || []).map(r => (r.staff || '').trim()).filter(Boolean)));
      return uniqueNames.map(name => ({ value: name, label: name }));
    },
    particulars: async () => {
      const { data, error } = await supabase.schema(schema).from('cash_book').select('particulars').not('particulars', 'is', null).neq('particulars', '').order('particulars');
      if (error) throw error;
      const uniqueParticulars = Array.from(new Set((data || []).map(r => (r.particulars || '').trim()).filter(Boolean)));
      return uniqueParticulars.sort();
    },
    payment_modes: async () => {
      const { data, error } = await supabase.schema(schema).from('cash_book').select('payment_mode').not('payment_mode', 'is', null).neq('payment_mode', '');
      if (error) throw error;
      const uniqueModes = Array.from(new Set((data || []).map(r => (r.payment_mode || '').trim()).filter(Boolean)));
      if (uniqueModes.length === 0) {
        return DEFAULT_PAYMENT_MODES;
      }
      return uniqueModes.map(mode => ({
        value: mode,
        label: mode === 'Online' ? 'Double' : mode === 'Bank Transfer' ? 'Bank' : mode
      }));
    }
  };

  console.log(`🔄 [offlineMasterData] Refreshing offline cache for mode "${mode}"...`);

  // Execute all queries and write to cache
  for (const [baseKey, fetchFn] of Object.entries(queries)) {
    // Generate target table key (regular has baseKey, itr has baseKey + "_itr")
    const tableKey = mode === 'itr' ? `${baseKey}_itr` : baseKey;
    const cacheId = `${tableKey}_${mode}`;

    try {
      const records = await fetchFn();
      await db.offline_master_data.put({
        id: cacheId,
        table_name: tableKey,
        mode,
        records,
        last_synced_at
      });
      console.log(`✅ [offlineMasterData] Cached ${records.length} records for ${tableKey}`);
    } catch (err) {
      console.error(`❌ [offlineMasterData] Failed to cache table ${tableKey}:`, err);
    }
  }

  // Dispatch global event for listeners to update
  window.dispatchEvent(new CustomEvent('offline-master-data-updated', { detail: { mode } }));
}

/**
 * Retrieve cached master data records for the given table key and mode
 */
export async function getCachedMasterData(tableName: string, mode: 'regular' | 'itr'): Promise<any[]> {
  try {
    const cacheId = `${tableName}_${mode}`;
    const cache = await db.offline_master_data.get(cacheId);
    if (cache && Array.isArray(cache.records)) {
      return cache.records;
    }
    return [];
  } catch (err) {
    console.error(`[offlineMasterData] Error reading cache for ${tableName} (${mode}):`, err);
    return [];
  }
}

/**
 * Sync both regular and ITR master data caches (if online)
 */
export async function syncAllMasterData(): Promise<void> {
  if (!navigator.onLine) return;
  console.log('🔄 [offlineMasterData] Triggering automatic cache sync for all modes...');
  await fetchAndCacheMasterData('regular');
  await fetchAndCacheMasterData('itr');
  console.log('✅ [offlineMasterData] Master data cache sync completed.');
}
