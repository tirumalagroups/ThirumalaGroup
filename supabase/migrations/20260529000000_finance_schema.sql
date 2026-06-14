-- Create finance-specific tables

-- 1. Partners Table
CREATE TABLE IF NOT EXISTS finance_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS finance_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  address text,
  aadhaar text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Loans Table
CREATE TABLE IF NOT EXISTS finance_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id text UNIQUE NOT NULL, -- Loan ID format, e.g., L-1001
  customer_id uuid REFERENCES finance_customers(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  amount decimal(15,2) NOT NULL,
  interest_rate decimal(5,2) NOT NULL, -- Interest percentage
  duration_months integer NOT NULL,
  due_type text CHECK (due_type IN ('Daily', 'Weekly', 'Monthly')) DEFAULT 'Daily',
  due_amount decimal(15,2) NOT NULL,
  surety_name text,
  surety_phone text,
  surety_aadhaar text,
  remarks text,
  status text CHECK (status IN ('Active', 'Closed')) DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Transactions Table (for loan payments / collections)
CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  date date DEFAULT CURRENT_DATE,
  amount decimal(15,2) NOT NULL,
  type text CHECK (type IN ('Collection', 'Disbursement', 'Interest Charge', 'Other')) NOT NULL,
  collected_by text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Capital Entries Table (partner investments)
CREATE TABLE IF NOT EXISTS finance_capital_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date DEFAULT CURRENT_DATE,
  partner_id uuid REFERENCES finance_partners(id) ON DELETE CASCADE,
  amount decimal(15,2) NOT NULL,
  type text CHECK (type IN ('Credit', 'Debit')) NOT NULL, -- Credit = invest, Debit = withdraw
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. Dues Table (to track expected payments per loan)
CREATE TABLE IF NOT EXISTS finance_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount decimal(15,2) NOT NULL,
  paid_amount decimal(15,2) DEFAULT 0,
  status text CHECK (status IN ('Pending', 'Paid', 'Partially Paid')) DEFAULT 'Pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Photos Table (base64 or storage urls for photos)
CREATE TABLE IF NOT EXISTS finance_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES finance_loans(id) ON DELETE CASCADE,
  photo_type text CHECK (photo_type IN ('Customer', 'Surety')) NOT NULL,
  photo_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. Edited Logs Table
CREATE TABLE IF NOT EXISTS finance_edited_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  edited_by text NOT NULL,
  edited_at timestamptz DEFAULT now()
);

-- 9. Deleted Logs Table
CREATE TABLE IF NOT EXISTS finance_deleted_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  old_values jsonb NOT NULL,
  deleted_by text NOT NULL,
  deleted_at timestamptz DEFAULT now()
);

-- 10. User Permissions Table for Finance
CREATE TABLE IF NOT EXISTS finance_user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, feature_key)
);

-- Enable RLS
ALTER TABLE finance_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_capital_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_edited_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_deleted_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_user_permissions ENABLE ROW LEVEL SECURITY;

-- Add simple authenticated policies (which allows app logic to work with authenticated connection)
CREATE POLICY "Allow authenticated full access to finance_partners" ON finance_partners FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_customers" ON finance_customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_loans" ON finance_loans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_transactions" ON finance_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_capital_entries" ON finance_capital_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_dues" ON finance_dues FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_photos" ON finance_photos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_edited_logs" ON finance_edited_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_deleted_logs" ON finance_deleted_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated full access to finance_user_permissions" ON finance_user_permissions FOR ALL TO authenticated USING (true) WITH CHECK (true);
