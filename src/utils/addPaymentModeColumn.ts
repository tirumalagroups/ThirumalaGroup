/**
 * Utility to add payment_mode column to cash_book table
 * This can be called from the frontend to check and provide instructions
 */

import { supabase } from '../lib/supabase';
import { getTableName } from '../lib/tableNames';

/**
 * Check if payment_mode column exists in cash_book table
 * @returns true if column exists, false if missing
 */
export async function checkPaymentModeColumnExists(): Promise<{
  exists: boolean;
  error?: string;
  message: string;
}> {
  try {
    // Try to select payment_mode from cash_book - if it fails with 42703, column doesn't exist
    const { error } = await supabase
      .from(getTableName('cash_book'))
      .select('payment_mode')
      .limit(1);

    if (error) {
      // ONLY treat PostgreSQL error code 42703 (undefined_column) as "column missing".
      // Any other error (RLS, network, auth) should NOT show the banner —
      // the column probably exists but we just can't read it right now.
      if (error.code === '42703') {
        return {
          exists: false,
          error: error.message,
          message: 'payment_mode column does not exist in cash_book table',
        };
      }
      // Some other error (RLS, network, auth) — assume column exists to avoid false banner
      console.warn('payment_mode check got non-42703 error (treating as exists):', error.code, error.message);
      return {
        exists: true,
        message: `Could not verify column (non-schema error): ${error.message}`,
      };
    }

    // No error means column exists!
    return {
      exists: true,
      message: 'payment_mode column exists ✓',
    };
  } catch (err: any) {
    // Network / unknown exception — assume exists to avoid false banner
    console.warn('payment_mode check threw exception (treating as exists):', err.message || String(err));
    return {
      exists: true,
      error: err.message || String(err),
      message: `Exception while checking column (treating as exists): ${err.message || String(err)}`,
    };
  }
}

/**
 * Get SQL command to add the column
 */
export function getAddColumnSQL(): string {
  return `ALTER TABLE cash_book 
ADD COLUMN IF NOT EXISTS payment_mode TEXT;

COMMENT ON COLUMN cash_book.payment_mode IS 'Payment mode: Cash, Bank Transfer, or Online';

CREATE INDEX IF NOT EXISTS idx_cash_book_payment_mode ON cash_book(payment_mode);`;
}

/**
 * Get instructions for adding the column
 */
export function getAddColumnInstructions(): string {
  return `
1. Go to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New query"
5. Copy and paste this SQL:

${getAddColumnSQL()}

6. Click "Run" button (or press Ctrl+Enter)
7. Verify success message appears
8. Refresh your browser (Ctrl+F5)
`;
}

