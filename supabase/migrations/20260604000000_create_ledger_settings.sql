-- Migration: create_ledger_settings
-- Description: Create the ledger_settings table for finance mode custom ledger calculations

CREATE TABLE IF NOT EXISTS ledger_settings (
    code text PRIMARY KEY,
    rate numeric NOT NULL,
    overdue numeric NOT NULL,
    method text NOT NULL,
    days_per_year integer NOT NULL,
    principal_rolls_on_renewal boolean NOT NULL DEFAULT false,
    updated_at timestamptz DEFAULT now()
);

-- Note: Policies and RLS will be added if needed, but since it's an internal app, we just create the table.
