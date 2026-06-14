import { QueryClient } from '@tanstack/react-query';
import { getTableMode } from './tableNames';

// Helper to get current table mode for query keys
const getTableModeForQuery = (): string => {
  return getTableMode();
};

// Helper to get current table book ID for query keys
const getTableBookForQuery = (): string => {
  const mode = getTableMode();
  const storageKey = mode === 'itr' ? 'itrSelectedBook' : 'regularSelectedBook';
  return localStorage.getItem(storageKey) || '';
};

// Create a client with optimized settings for SPA behavior
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      // Keep data fresh longer to avoid refetch on back/forward
      staleTime: 15 * 60 * 1000, // 15 minutes
      // Keep cache around longer between navigations
      gcTime: 30 * 60 * 1000, // 30 minutes
      // Retry failed requests 2 times
      retry: 2,
      // Don't refetch on window focus for better UX
      refetchOnWindowFocus: false,
      // Only refetch on reconnect if stale
      refetchOnReconnect: 'always',
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
      // Structural sharing for faster cache updates
      structuralSharing: true,
    },
    mutations: {
      networkMode: 'always',
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys for consistent caching
// Include table mode and book ID in query keys so React Query treats different modes/books as separate
export const queryKeys = {
  // Dashboard queries
  dashboard: {
    stats: (date?: string) => ['dashboard', 'stats', getTableModeForQuery(), getTableBookForQuery(), date] as const,
    recentEntries: () => ['dashboard', 'recentEntries', getTableModeForQuery(), getTableBookForQuery()] as const,
    companyBalances: () => ['dashboard', 'companyBalances', getTableModeForQuery(), getTableBookForQuery()] as const,
  },
  // Cash book queries
  cashBook: {
    all: () => ['cashBook', 'all', getTableModeForQuery(), getTableBookForQuery()] as const,
    list: (page: number, limit: number) => ['cashBook', 'list', getTableModeForQuery(), getTableBookForQuery(), page, limit] as const,
    byId: (id: string) => ['cashBook', 'detail', getTableModeForQuery(), getTableBookForQuery(), id] as const,
    byDate: (date: string) => ['cashBook', 'byDate', getTableModeForQuery(), getTableBookForQuery(), date] as const,
  },
  // Dropdown data queries (accounts/subaccounts/companies change with mode/book, users don't)
  dropdowns: {
    companies: () => ['dropdowns', 'companies', getTableModeForQuery(), getTableBookForQuery()] as const,
    accounts: () => ['dropdowns', 'accounts', getTableModeForQuery(), getTableBookForQuery()] as const,
    subAccounts: () => ['dropdowns', 'subAccounts', getTableModeForQuery(), getTableBookForQuery()] as const,
    users: () => ['dropdowns', 'users'] as const, // Shared between modes
  },
  // Approval queries
  approvals: {
    pending: () => ['approvals', 'pending', getTableModeForQuery(), getTableBookForQuery()] as const,
    count: () => ['approvals', 'count', getTableModeForQuery(), getTableBookForQuery()] as const,
  },
} as const;

