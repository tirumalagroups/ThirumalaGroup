/**
 * Helper functions to get table names based on current mode (regular or ITR)
 * Reads mode from localStorage to work outside React context
 */

export type TableMode = 'regular' | 'itr' | 'finance';

/**
 * Get current table mode from localStorage/sessionStorage
 */
export const getTableMode = (): TableMode => {
  const saved = sessionStorage.getItem('table_mode') || localStorage.getItem('table_mode');
  if (saved === 'itr' || saved === 'finance' || saved === 'regular') {
    return saved as TableMode;
  }
  return 'regular';
};

/**
 * Get table name based on current mode (returns baseName directly as schema resolution is dynamic)
 * @param baseName - Base table name (e.g., 'cash_book')
 * @param mode - Optional mode override
 * @returns Base table name
 */
export const getTableName = (baseName: string, _mode?: TableMode): string => {
  return baseName;
};

/**
 * Get multiple table names at once
 */
export const getTableNames = (baseNames: string[], mode?: TableMode): Record<string, string> => {
  const result: Record<string, string> = {};
  baseNames.forEach(name => {
    result[name] = getTableName(name, mode);
  });
  return result;
};

