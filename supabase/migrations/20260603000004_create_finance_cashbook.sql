-- Create finance_cashbook_accounts table
CREATE TABLE IF NOT EXISTS finance_cashbook_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL UNIQUE,
  account_number text,
  created_at timestamptz DEFAULT now()
);

-- Create finance_cashbook_entries table
CREATE TABLE IF NOT EXISTS finance_cashbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  account_number text,
  head_of_account text NOT NULL,
  particulars text NOT NULL,
  credit numeric NOT NULL DEFAULT 0,
  debit numeric NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disable Row Level Security on both tables for local unauthenticated API access model
ALTER TABLE finance_cashbook_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_cashbook_entries DISABLE ROW LEVEL SECURITY;
