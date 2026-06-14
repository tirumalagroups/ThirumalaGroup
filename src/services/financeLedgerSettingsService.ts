import { supabase } from '../lib/supabase';
import { FinanceLedgerSetting } from '../lib/supabaseFinance';

const CACHE_KEY = 'finance_ledger_settings_cache';

export const DEFAULT_LEDGER_SETTINGS: Record<string, FinanceLedgerSetting> = {
  'CD': { code: 'CD', rate: 3, overdue: 0.75, method: 'SIMPLE_DAILY', days_per_year: 365, principal_rolls_on_renewal: true },
  'HP': { code: 'HP', rate: 3, overdue: 0.75, method: 'FLAT_EMI', days_per_year: 365, principal_rolls_on_renewal: false },
  'STBD': { code: 'STBD', rate: 3, overdue: 0.75, method: 'FLAT_EMI', days_per_year: 365, principal_rolls_on_renewal: false },
  'TBD': { code: 'TBD', rate: 3, overdue: 0.75, method: 'COMPOUND_MONTHLY', days_per_year: 365, principal_rolls_on_renewal: false },
  'FD': { code: 'FD', rate: 3, overdue: 0.75, method: 'COMPOUND_MONTHLY', days_per_year: 365, principal_rolls_on_renewal: false },
  'OD': { code: 'OD', rate: 3, overdue: 0.75, method: 'SIMPLE_DAILY', days_per_year: 365, principal_rolls_on_renewal: true },
  'RD': { code: 'RD', rate: 3, overdue: 0.75, method: 'COMPOUND_MONTHLY', days_per_year: 365, principal_rolls_on_renewal: false },
};

export const financeLedgerSettingsService = {
  async getAllLedgerSettings(): Promise<Record<string, FinanceLedgerSetting>> {
    try {
      // 1. Try fetching from Supabase
      const { data, error } = await supabase.from('ledger_settings').select('*');
      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet, return defaults
          return this.getCachedOrDefaultSettings();
        }
        throw error;
      }
      
      const settingsMap: Record<string, FinanceLedgerSetting> = { ...DEFAULT_LEDGER_SETTINGS };
      if (data && data.length > 0) {
        data.forEach(setting => {
          settingsMap[setting.code] = setting;
        });
        
        // Cache to local storage
        localStorage.setItem(CACHE_KEY, JSON.stringify(settingsMap));
      }
      return settingsMap;
    } catch (err) {
      console.error('Error fetching ledger settings:', err);
      // Fallback to cache or defaults
      return this.getCachedOrDefaultSettings();
    }
  },

  getCachedOrDefaultSettings(): Record<string, FinanceLedgerSetting> {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Merge with defaults in case of missing keys
        return { ...DEFAULT_LEDGER_SETTINGS, ...parsed };
      }
    } catch (e) {
      console.warn('Error reading ledger settings cache', e);
    }
    return { ...DEFAULT_LEDGER_SETTINGS };
  },

  async getLedgerSettings(ledgerCode: string): Promise<FinanceLedgerSetting> {
    const all = await this.getAllLedgerSettings();
    return all[ledgerCode] || DEFAULT_LEDGER_SETTINGS[ledgerCode] || DEFAULT_LEDGER_SETTINGS['CD'];
  },

  async saveLedgerSetting(setting: FinanceLedgerSetting): Promise<void> {
    const { error } = await supabase
      .from('ledger_settings')
      .upsert({
        code: setting.code,
        rate: setting.rate,
        overdue: setting.overdue,
        method: setting.method,
        days_per_year: setting.days_per_year,
        principal_rolls_on_renewal: setting.principal_rolls_on_renewal,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' });

    if (error) throw error;
    
    // Update cache
    const current = this.getCachedOrDefaultSettings();
    current[setting.code] = setting;
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  },

  async deleteLedgerSetting(code: string): Promise<void> {
    const { error } = await supabase
      .from('ledger_settings')
      .delete()
      .eq('code', code);

    if (error) throw error;

    // Update cache
    const current = this.getCachedOrDefaultSettings();
    delete current[code];
    localStorage.setItem(CACHE_KEY, JSON.stringify(current));
  }
};
