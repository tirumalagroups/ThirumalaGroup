-- Migration: Atomic Receipt Number Sequence Reset
-- Targets: finance_transactions, finance_cd_ledger_entries, finance_cd_interest_details
-- Date: 2026-07-07

-- Create PostgreSQL sequence starting at 1000 in the finance schema
CREATE SEQUENCE IF NOT EXISTS finance.finance_receipt_sequence START WITH 1000;

-- Create function to atomically fetch the next receipt number
CREATE OR REPLACE FUNCTION finance.get_next_finance_receipt_no()
RETURNS text AS $$
DECLARE
  next_val bigint;
BEGIN
  -- Atomically fetch and increment the sequence
  next_val := nextval('finance.finance_receipt_sequence');
  RETURN 'RC' || next_val::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant usage on the sequence and execution privileges on the function to postgrest roles
GRANT USAGE, SELECT ON SEQUENCE finance.finance_receipt_sequence TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION finance.get_next_finance_receipt_no() TO anon, authenticated, service_role;
