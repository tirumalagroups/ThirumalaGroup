/*
  # Thirumala Group Database Schema (Complete Migration File)
  
  This file creates all the necessary tables for Thirumala Business Management System
  supporting both Regular and ITR modes.

  1. Core Tables
    - `user_types` - Admin/Operator role definitions
    - `users` - User authentication, profile, and personal details
    - `features` - Available system features for permissions
    - `user_access` - User feature permission mappings by mode
    - `companies` / `companies_itr` - Company master data
    - `company_main_accounts` / `company_main_accounts_itr` - Accounts mapping
    - `company_main_sub_acc` / `company_main_sub_acc_itr` - Sub-accounts mapping
    - `cash_book` / `cash_book_itr` - Main transaction ledger
    - `edit_cash_book` / `edit_cash_book_itr` - Audit trail for all edits
    - `original_cash_book` / `original_cash_book_itr` - Backup of original entries before edits
    - `deleted_cash_book` / `deleted_cash_book_itr` - Soft-deleted records tracking
    - `vehicles` / `vehicles_itr` - Vehicle registration and expiry tracking
    - `drivers` / `drivers_itr` - Driver licenses and expiry tracking
    - `bank_guarantees` / `bank_guarantees_itr` - Bank guarantee tracking
    - `balance_sheet` / `balance_sheet_itr` - Balance sheet tracking
    - `ledger` / `ledger_itr` - General ledger tracking
    - `login_attempts` - Rate limiting for login
    - `login_activities` - Login activity log for audit
    - `user_credentials_log` - Administrator logs for newly created user credentials
*/

-- ==========================================
-- 1. Helper Stored Procedures (RPCs)
-- ==========================================

-- exec_sql: Allows admin scripts to run raw SQL
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- disable_fk_checks: Temporarily disable constraint checks during CSV upload
CREATE OR REPLACE FUNCTION disable_fk_checks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SET session_replication_role = replica;
END;
$$;

-- disable_rls_temporarily: Temporarily disables RLS for seed scripts
CREATE OR REPLACE FUNCTION disable_rls_temporarily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ALTER TABLE user_types DISABLE ROW LEVEL SECURITY;
  ALTER TABLE users DISABLE ROW LEVEL SECURITY;
  ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
  ALTER TABLE company_main_accounts DISABLE ROW LEVEL SECURITY;
  ALTER TABLE company_main_sub_acc DISABLE ROW LEVEL SECURITY;
  ALTER TABLE cash_book DISABLE ROW LEVEL SECURITY;
  ALTER TABLE edit_cash_book DISABLE ROW LEVEL SECURITY;
  ALTER TABLE original_cash_book DISABLE ROW LEVEL SECURITY;
  ALTER TABLE balance_sheet DISABLE ROW LEVEL SECURITY;
  ALTER TABLE ledger DISABLE ROW LEVEL SECURITY;
  ALTER TABLE bank_guarantees DISABLE ROW LEVEL SECURITY;
  ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE drivers DISABLE ROW LEVEL SECURITY;
  ALTER TABLE deleted_cash_book DISABLE ROW LEVEL SECURITY;
END;
$$;


-- ==========================================
-- 2. Core Security & Roles Tables
-- ==========================================

-- User Types
CREATE TABLE IF NOT EXISTS user_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Users (Includes all optional fields required by the user management page)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  user_type_id uuid REFERENCES user_types(id),
  is_active boolean DEFAULT true,
  mode text CHECK (mode IN ('regular','itr')) DEFAULT 'regular',
  aadhaar_number text,
  address text,
  phone text,
  full_name text,
  date_of_birth date,
  other_details text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Features (Manually managed features)
CREATE TABLE IF NOT EXISTS features (
  key text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- User Access
CREATE TABLE IF NOT EXISTS user_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  feature_key text REFERENCES features(key) ON DELETE CASCADE,
  mode text CHECK (mode IN ('regular','itr')) DEFAULT 'regular',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, feature_key, mode)
);


-- ==========================================
-- 3. Regular Mode Tables
-- ==========================================

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL UNIQUE,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Company Main Accounts
CREATE TABLE IF NOT EXISTS company_main_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text REFERENCES companies(company_name) ON DELETE CASCADE,
  acc_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_name, acc_name)
);

-- Company Main Sub Accounts
CREATE TABLE IF NOT EXISTS company_main_sub_acc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  acc_name text,
  sub_acc text NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (company_name, acc_name) REFERENCES company_main_accounts(company_name, acc_name) ON DELETE CASCADE,
  UNIQUE (company_name, acc_name, sub_acc)
);

-- Cash Book (Main Transaction Table)
CREATE TABLE IF NOT EXISTS cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  acc_name text NOT NULL,
  sub_acc_name text,
  particulars text,
  c_date date DEFAULT CURRENT_DATE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  credit_online decimal(15,2) DEFAULT 0,
  credit_offline decimal(15,2) DEFAULT 0,
  debit_online decimal(15,2) DEFAULT 0,
  debit_offline decimal(15,2) DEFAULT 0,
  lock_record boolean DEFAULT false,
  company_name text REFERENCES companies(company_name) ON DELETE SET NULL,
  address text,
  staff text,
  users text,
  entry_time timestamptz DEFAULT now(),
  sale_qty decimal(10,2) DEFAULT 0,
  purchase_qty decimal(10,2) DEFAULT 0,
  approved boolean DEFAULT false,
  edited boolean DEFAULT false,
  e_count integer DEFAULT 0,
  cb text,
  payment_mode text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Edit Cash Book (Audit Trail)
CREATE TABLE IF NOT EXISTS edit_cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid REFERENCES cash_book(id) ON DELETE SET NULL,
  sno integer,
  acc_name text,
  sub_acc_name text,
  particulars text,
  c_date date,
  credit decimal(15,2),
  debit decimal(15,2),
  lock_record boolean,
  company_name text,
  address text,
  staff text,
  users text,
  entry_time timestamptz,
  sale_qty decimal(10,2),
  purchase_qty decimal(10,2),
  approved boolean,
  edited boolean,
  e_count integer,
  cb text,
  o_credit decimal(15,2),
  o_debit decimal(15,2),
  o_company_name text,
  o_date date,
  o_user text,
  edited_user text,
  edited_time timestamptz DEFAULT now(),
  deleted_flag boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Original Cash Book (Backup)
CREATE TABLE IF NOT EXISTS original_cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_cb_id uuid,
  sno integer,
  acc_name text,
  sub_acc_name text,
  particulars text,
  c_date date,
  credit decimal(15,2),
  debit decimal(15,2),
  company_name text,
  staff text,
  users text,
  backup_time timestamptz DEFAULT now()
);

-- Deleted Cash Book
CREATE TABLE IF NOT EXISTS deleted_cash_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  acc_name text NOT NULL,
  sub_acc_name text,
  particulars text,
  c_date date DEFAULT CURRENT_DATE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  credit_online decimal(15,2) DEFAULT 0,
  credit_offline decimal(15,2) DEFAULT 0,
  debit_online decimal(15,2) DEFAULT 0,
  debit_offline decimal(15,2) DEFAULT 0,
  lock_record boolean DEFAULT false,
  company_name text,
  address text,
  staff text,
  users text,
  entry_time timestamptz DEFAULT now(),
  sale_qty decimal(10,2) DEFAULT 0,
  purchase_qty decimal(10,2) DEFAULT 0,
  approved boolean DEFAULT false,
  edited boolean DEFAULT false,
  e_count integer DEFAULT 0,
  cb text,
  payment_mode text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_by text,
  deleted_at timestamptz DEFAULT now()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  v_no text NOT NULL UNIQUE,
  v_type text,
  particulars text,
  tax_exp_date date,
  insurance_exp_date date,
  fitness_exp_date date,
  permit_exp_date date,
  date_added date DEFAULT CURRENT_DATE,
  rc_front_url text,
  rc_back_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  driver_name text NOT NULL,
  license_no text UNIQUE,
  exp_date date,
  particulars text,
  phone text,
  address text,
  license_front_url text,
  license_back_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bank Guarantees
CREATE TABLE IF NOT EXISTS bank_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  bg_no text NOT NULL UNIQUE,
  issue_date date,
  exp_date date,
  work_name text,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  department text,
  cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Balance Sheet
CREATE TABLE IF NOT EXISTS balance_sheet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_name text NOT NULL UNIQUE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  balance decimal(15,2) DEFAULT 0,
  yes_no text CHECK (yes_no IN ('YES', 'NO', 'BOTH')),
  both_value text,
  result text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ledger
CREATE TABLE IF NOT EXISTS ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_name text NOT NULL,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  balance decimal(15,2) DEFAULT 0,
  yes_no text CHECK (yes_no IN ('YES', 'NO', 'BOTH')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- ==========================================
-- 4. ITR Mode Tables (Identical Structures)
-- ==========================================

-- Companies ITR
CREATE TABLE IF NOT EXISTS companies_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL UNIQUE,
  address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Company Main Accounts ITR
CREATE TABLE IF NOT EXISTS company_main_accounts_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text REFERENCES companies_itr(company_name) ON DELETE CASCADE,
  acc_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (company_name, acc_name)
);

-- Company Main Sub Accounts ITR
CREATE TABLE IF NOT EXISTS company_main_sub_acc_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text,
  acc_name text,
  sub_acc text NOT NULL,
  created_at timestamptz DEFAULT now(),
  FOREIGN KEY (company_name, acc_name) REFERENCES company_main_accounts_itr(company_name, acc_name) ON DELETE CASCADE,
  UNIQUE (company_name, acc_name, sub_acc)
);

-- Cash Book ITR
CREATE TABLE IF NOT EXISTS cash_book_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  acc_name text NOT NULL,
  sub_acc_name text,
  particulars text,
  c_date date DEFAULT CURRENT_DATE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  credit_online decimal(15,2) DEFAULT 0,
  credit_offline decimal(15,2) DEFAULT 0,
  debit_online decimal(15,2) DEFAULT 0,
  debit_offline decimal(15,2) DEFAULT 0,
  lock_record boolean DEFAULT false,
  company_name text REFERENCES companies_itr(company_name) ON DELETE SET NULL,
  address text,
  staff text,
  users text,
  entry_time timestamptz DEFAULT now(),
  sale_qty decimal(10,2) DEFAULT 0,
  purchase_qty decimal(10,2) DEFAULT 0,
  approved boolean DEFAULT false,
  edited boolean DEFAULT false,
  e_count integer DEFAULT 0,
  cb text,
  payment_mode text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Edit Cash Book ITR
CREATE TABLE IF NOT EXISTS edit_cash_book_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id uuid REFERENCES cash_book_itr(id) ON DELETE SET NULL,
  sno integer,
  acc_name text,
  sub_acc_name text,
  particulars text,
  c_date date,
  credit decimal(15,2),
  debit decimal(15,2),
  lock_record boolean,
  company_name text,
  address text,
  staff text,
  users text,
  entry_time timestamptz,
  sale_qty decimal(10,2),
  purchase_qty decimal(10,2),
  approved boolean,
  edited boolean,
  e_count integer,
  cb text,
  o_credit decimal(15,2),
  o_debit decimal(15,2),
  o_company_name text,
  o_date date,
  o_user text,
  edited_user text,
  edited_time timestamptz DEFAULT now(),
  deleted_flag boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Original Cash Book ITR
CREATE TABLE IF NOT EXISTS original_cash_book_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_cb_id uuid,
  sno integer,
  acc_name text,
  sub_acc_name text,
  particulars text,
  c_date date,
  credit decimal(15,2),
  debit decimal(15,2),
  company_name text,
  staff text,
  users text,
  backup_time timestamptz DEFAULT now()
);

-- Deleted Cash Book ITR
CREATE TABLE IF NOT EXISTS deleted_cash_book_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  acc_name text NOT NULL,
  sub_acc_name text,
  particulars text,
  c_date date DEFAULT CURRENT_DATE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  credit_online decimal(15,2) DEFAULT 0,
  credit_offline decimal(15,2) DEFAULT 0,
  debit_online decimal(15,2) DEFAULT 0,
  debit_offline decimal(15,2) DEFAULT 0,
  lock_record boolean DEFAULT false,
  company_name text,
  address text,
  staff text,
  users text,
  entry_time timestamptz DEFAULT now(),
  sale_qty decimal(10,2) DEFAULT 0,
  purchase_qty decimal(10,2) DEFAULT 0,
  approved boolean DEFAULT false,
  edited boolean DEFAULT false,
  e_count integer DEFAULT 0,
  cb text,
  payment_mode text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_by text,
  deleted_at timestamptz DEFAULT now()
);

-- Vehicles ITR
CREATE TABLE IF NOT EXISTS vehicles_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  v_no text NOT NULL UNIQUE,
  v_type text,
  particulars text,
  tax_exp_date date,
  insurance_exp_date date,
  fitness_exp_date date,
  permit_exp_date date,
  date_added date DEFAULT CURRENT_DATE,
  rc_front_url text,
  rc_back_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Drivers ITR
CREATE TABLE IF NOT EXISTS drivers_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  driver_name text NOT NULL,
  license_no text UNIQUE,
  exp_date date,
  particulars text,
  phone text,
  address text,
  license_front_url text,
  license_back_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bank Guarantees ITR
CREATE TABLE IF NOT EXISTS bank_guarantees_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sno serial,
  bg_no text NOT NULL UNIQUE,
  issue_date date,
  exp_date date,
  work_name text,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  department text,
  cancelled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Balance Sheet ITR
CREATE TABLE IF NOT EXISTS balance_sheet_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_name text NOT NULL UNIQUE,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  balance decimal(15,2) DEFAULT 0,
  yes_no text CHECK (yes_no IN ('YES', 'NO', 'BOTH')),
  both_value text,
  result text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ledger ITR
CREATE TABLE IF NOT EXISTS ledger_itr (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_name text NOT NULL,
  credit decimal(15,2) DEFAULT 0,
  debit decimal(15,2) DEFAULT 0,
  balance decimal(15,2) DEFAULT 0,
  yes_no text CHECK (yes_no IN ('YES', 'NO', 'BOTH')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


-- ==========================================
-- 5. Additional System Logging Tables
-- ==========================================

-- Login Attempts (for rate limiting)
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  count integer DEFAULT 1,
  last_attempt bigint NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Login Activities (for audit trail)
CREATE TABLE IF NOT EXISTS login_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  user_agent text,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

-- User Credentials Log
CREATE TABLE IF NOT EXISTS user_credentials_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username text NOT NULL,
  password text NOT NULL,
  is_admin boolean DEFAULT false,
  features text[] DEFAULT '{}',
  features_by_mode jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_log_created_at 
ON user_credentials_log (created_at DESC);


-- ==========================================
-- 6. Row Level Security Policies Configuration
-- ==========================================

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE user_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_main_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_main_sub_acc ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_cash_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE original_cash_book ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_guarantees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_cash_book ENABLE ROW LEVEL SECURITY;

-- Enable RLS on ITR tables
ALTER TABLE companies_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_main_accounts_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_main_sub_acc_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_book_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE edit_cash_book_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE original_cash_book_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_sheet_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_guarantees_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers_itr ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_cash_book_itr ENABLE ROW LEVEL SECURITY;

-- Enable RLS on System log tables
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_credentials_log ENABLE ROW LEVEL SECURITY;

-- DROP Policies if they exist (allows safe re-run of this script)
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin can access all data" ON users;
DROP POLICY IF EXISTS "Authenticated users can read companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can read accounts" ON company_main_accounts;
DROP POLICY IF EXISTS "Authenticated users can read sub accounts" ON company_main_sub_acc;
DROP POLICY IF EXISTS "Authenticated users can read user types" ON user_types;
DROP POLICY IF EXISTS "Users can read cash book" ON cash_book;
DROP POLICY IF EXISTS "Users can insert cash book" ON cash_book;
DROP POLICY IF EXISTS "Admin can update cash book" ON cash_book;
DROP POLICY IF EXISTS "Users can access operational data" ON bank_guarantees;
DROP POLICY IF EXISTS "Users can access vehicle data" ON vehicles;
DROP POLICY IF EXISTS "Users can access driver data" ON drivers;
DROP POLICY IF EXISTS "Users can access ledger data" ON ledger;
DROP POLICY IF EXISTS "Users can access balance sheet" ON balance_sheet;
DROP POLICY IF EXISTS "Users can access edit history" ON edit_cash_book;
DROP POLICY IF EXISTS "Users can access original cash book" ON original_cash_book;
DROP POLICY IF EXISTS "Users can manage login attempts" ON login_attempts;
DROP POLICY IF EXISTS "Users can read login activities" ON login_activities;
DROP POLICY IF EXISTS "Users can insert login activities" ON login_activities;

-- Drop ITR policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read companies_itr" ON companies_itr;
DROP POLICY IF EXISTS "Authenticated users can read accounts_itr" ON company_main_accounts_itr;
DROP POLICY IF EXISTS "Authenticated users can read sub accounts_itr" ON company_main_sub_acc_itr;
DROP POLICY IF EXISTS "Users can read cash book_itr" ON cash_book_itr;
DROP POLICY IF EXISTS "Users can insert cash book_itr" ON cash_book_itr;
DROP POLICY IF EXISTS "Admin can update cash book_itr" ON cash_book_itr;
DROP POLICY IF EXISTS "Users can access operational data_itr" ON bank_guarantees_itr;
DROP POLICY IF EXISTS "Users can access vehicle data_itr" ON vehicles_itr;
DROP POLICY IF EXISTS "Users can access driver data_itr" ON drivers_itr;
DROP POLICY IF EXISTS "Users can access ledger data_itr" ON ledger_itr;
DROP POLICY IF EXISTS "Users can access balance sheet_itr" ON balance_sheet_itr;
DROP POLICY IF EXISTS "Users can access edit history_itr" ON edit_cash_book_itr;
DROP POLICY IF EXISTS "Users can access original cash book_itr" ON original_cash_book_itr;

-- Drop credentials policies if they exist
DROP POLICY IF EXISTS "Admins can view credentials" ON user_credentials_log;
DROP POLICY IF EXISTS "Admins can insert credentials" ON user_credentials_log;
DROP POLICY IF EXISTS "Admins can delete credentials" ON user_credentials_log;

-- Recreate RLS Policies
-- Users table: users can read their own profile
CREATE POLICY "Users can read own data" ON users
  FOR SELECT TO authenticated
  USING (auth.uid()::text = id::text);

-- Users table: Admin can do anything
CREATE POLICY "Admin can access all data" ON users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id::text = auth.uid()::text AND ut.user_type = 'Admin'
    )
  );

-- Master data: Authenticated users can read
CREATE POLICY "Authenticated users can read companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read accounts" ON company_main_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read sub accounts" ON company_main_sub_acc FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read user types" ON user_types FOR SELECT TO authenticated USING (true);

-- Master data ITR: Authenticated users can read
CREATE POLICY "Authenticated users can read companies_itr" ON companies_itr FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read accounts_itr" ON company_main_accounts_itr FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read sub accounts_itr" ON company_main_sub_acc_itr FOR SELECT TO authenticated USING (true);

-- Cash Book Policies (Permissive inserts and selects, admin updates)
CREATE POLICY "Users can read cash book" ON cash_book FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert cash book" ON cash_book FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update cash book" ON cash_book
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id::text = auth.uid()::text AND ut.user_type = 'Admin'
    )
  );

-- Cash Book ITR Policies
CREATE POLICY "Users can read cash book_itr" ON cash_book_itr FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert cash book_itr" ON cash_book_itr FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can update cash book_itr" ON cash_book_itr
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      JOIN user_types ut ON u.user_type_id = ut.id
      WHERE u.id::text = auth.uid()::text AND ut.user_type = 'Admin'
    )
  );

-- Basic Policies for other Regular tables (Open to authenticated)
CREATE POLICY "Users can access operational data" ON bank_guarantees FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access vehicle data" ON vehicles FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access driver data" ON drivers FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access ledger data" ON ledger FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access balance sheet" ON balance_sheet FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access edit history" ON edit_cash_book FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access original cash book" ON original_cash_book FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access deleted cash book" ON deleted_cash_book FOR ALL TO authenticated USING (true);

-- Basic Policies for other ITR tables (Open to authenticated)
CREATE POLICY "Users can access operational data_itr" ON bank_guarantees_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access vehicle data_itr" ON vehicles_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access driver data_itr" ON drivers_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access ledger data_itr" ON ledger_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access balance sheet_itr" ON balance_sheet_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access edit history_itr" ON edit_cash_book_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access original cash book_itr" ON original_cash_book_itr FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can access deleted cash book_itr" ON deleted_cash_book_itr FOR ALL TO authenticated USING (true);

-- Log table policies (Open to authenticated)
CREATE POLICY "Users can manage login attempts" ON login_attempts FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can read login activities" ON login_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert login activities" ON login_activities FOR INSERT TO authenticated WITH CHECK (true);

-- Admin credentials logs policies
CREATE POLICY "Admins can view credentials" ON user_credentials_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM user_types 
        WHERE user_types.id = users.user_type_id 
        AND user_types.user_type = 'Admin'
      )
    )
  );

CREATE POLICY "Admins can insert credentials" ON user_credentials_log
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM user_types 
        WHERE user_types.id = users.user_type_id 
        AND user_types.user_type = 'Admin'
      )
    )
  );

CREATE POLICY "Admins can delete credentials" ON user_credentials_log
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text
      AND EXISTS (
        SELECT 1 FROM user_types 
        WHERE user_types.id = users.user_type_id 
        AND user_types.user_type = 'Admin'
      )
    )
  );


-- ==========================================
-- 7. Seed Initial System Data & Accounts
-- ==========================================

-- Seed User Types
INSERT INTO user_types (user_type) VALUES 
  ('Admin'),
  ('Operator')
ON CONFLICT (user_type) DO NOTHING;

-- Seed Default Admin & Operator Users with properly hashed passwords
-- Default password: admin -> admin123, operator -> op123, RAMESH -> ramesh123, TC DOUBLE A/C -> tc123
INSERT INTO users (username, email, password_hash, user_type_id, is_active)
VALUES 
  ('admin', 'admin@thirumala.com', '$2b$10$NXfwCFd4HQj5Pdefywi.fOUC4w8DmuaeXqppOLfWSJ26mjiQlnf26', (SELECT id FROM user_types WHERE user_type = 'Admin' LIMIT 1), true),
  ('operator', 'operator@thirumala.com', '$2b$10$bnxDA4xy80p00k5N10EGFOj8N77.rIUThopgvbXRiq6QxOkz009kG', (SELECT id FROM user_types WHERE user_type = 'Operator' LIMIT 1), true),
  ('RAMESH', 'ramesh@thirumala.com', '$2b$10$HWHpIrt9GT5cwwF8/ucc0.91uQrQnEffmLVVPrVV2QVVaIznMO.WW', (SELECT id FROM user_types WHERE user_type = 'Operator' LIMIT 1), true),
  ('TC DOUBLE A/C', 'tc@thirumala.com', '$2b$10$xv7eE0a0ODScMe9Y6PZbre7X1OxQ/8u3nYE04sDL4i2kI.18K6whO', (SELECT id FROM user_types WHERE user_type = 'Operator' LIMIT 1), true)
ON CONFLICT (username) DO NOTHING;

-- Seed Features for Non-Admin Permissions Control
INSERT INTO features (key, name) VALUES
  ('dashboard', 'Dashboard'),
  ('new_entry', 'New Entry'),
  ('edit_entry', 'Edit Entry'),
  ('daily_report', 'Daily Report'),
  ('detailed_ledger', 'Detailed Ledger'),
  ('ledger_summary', 'Ledger Summary'),
  ('approve_records', 'Approve Records'),
  ('edited_records', 'Edited Records'),
  ('deleted_records', 'Deleted Records'),
  ('replace_form', 'Replace Form'),
  ('balance_sheet', 'Balance Sheet'),
  ('export', 'Export'),
  ('csv_upload', 'CSV Upload'),
  ('vehicles', 'Vehicles'),
  ('drivers', 'Drivers'),
  ('bank_guarantees', 'Bank Guarantees'),
  ('users', 'Users')
ON CONFLICT (key) DO NOTHING;

-- Seed Regular Mode Companies
INSERT INTO companies (company_name, address) VALUES 
  ('Thirumala Cotton Mills', 'Main Branch Address'),
  ('Thirumala Exports', 'Export Division Address'),
  ('Thirumala Trading', 'Trading Division Address')
ON CONFLICT (company_name) DO NOTHING;

-- Seed Regular Mode Accounts
INSERT INTO company_main_accounts (company_name, acc_name) VALUES 
  ('Thirumala Cotton Mills', 'Sales Account'),
  ('Thirumala Cotton Mills', 'Purchase Account'),
  ('Thirumala Cotton Mills', 'Expense Account'),
  ('Thirumala Cotton Mills', 'Cash Account'),
  ('Thirumala Cotton Mills', 'Bank Account'),
  ('Thirumala Exports', 'Export Sales'),
  ('Thirumala Exports', 'Export Expenses'),
  ('Thirumala Trading', 'Trading Income'),
  ('Thirumala Trading', 'Trading Expenses')
ON CONFLICT (company_name, acc_name) DO NOTHING;

-- Seed Regular Mode Sub Accounts
INSERT INTO company_main_sub_acc (company_name, acc_name, sub_acc) VALUES 
  ('Thirumala Cotton Mills', 'Sales Account', 'Local Sales'),
  ('Thirumala Cotton Mills', 'Sales Account', 'Interstate Sales'),
  ('Thirumala Cotton Mills', 'Purchase Account', 'Raw Material'),
  ('Thirumala Cotton Mills', 'Purchase Account', 'Machinery'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Office Expense'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Transport'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Salary'),
  ('Thirumala Exports', 'Export Sales', 'Cotton Export'),
  ('Thirumala Exports', 'Export Expenses', 'Shipping'),
  ('Thirumala Trading', 'Trading Income', 'Commission')
ON CONFLICT (company_name, acc_name, sub_acc) DO NOTHING;

-- Seed ITR Mode Companies
INSERT INTO companies_itr (company_name, address) VALUES 
  ('Thirumala Cotton Mills', 'Main Branch Address'),
  ('Thirumala Exports', 'Export Division Address'),
  ('Thirumala Trading', 'Trading Division Address')
ON CONFLICT (company_name) DO NOTHING;

-- Seed ITR Mode Accounts
INSERT INTO company_main_accounts_itr (company_name, acc_name) VALUES 
  ('Thirumala Cotton Mills', 'Sales Account'),
  ('Thirumala Cotton Mills', 'Purchase Account'),
  ('Thirumala Cotton Mills', 'Expense Account'),
  ('Thirumala Cotton Mills', 'Cash Account'),
  ('Thirumala Cotton Mills', 'Bank Account'),
  ('Thirumala Exports', 'Export Sales'),
  ('Thirumala Exports', 'Export Expenses'),
  ('Thirumala Trading', 'Trading Income'),
  ('Thirumala Trading', 'Trading Expenses')
ON CONFLICT (company_name, acc_name) DO NOTHING;

-- Seed ITR Mode Sub Accounts
INSERT INTO company_main_sub_acc_itr (company_name, acc_name, sub_acc) VALUES 
  ('Thirumala Cotton Mills', 'Sales Account', 'Local Sales'),
  ('Thirumala Cotton Mills', 'Sales Account', 'Interstate Sales'),
  ('Thirumala Cotton Mills', 'Purchase Account', 'Raw Material'),
  ('Thirumala Cotton Mills', 'Purchase Account', 'Machinery'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Office Expense'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Transport'),
  ('Thirumala Cotton Mills', 'Expense Account', 'Salary'),
  ('Thirumala Exports', 'Export Sales', 'Cotton Export'),
  ('Thirumala Exports', 'Export Expenses', 'Shipping'),
  ('Thirumala Trading', 'Trading Income', 'Commission')
ON CONFLICT (company_name, acc_name, sub_acc) DO NOTHING;

-- Clean up helper function for user credentials log table (runs periodically or can be triggered manually)
CREATE OR REPLACE FUNCTION cleanup_old_credentials()
RETURNS void AS $$
BEGIN
  DELETE FROM user_credentials_log
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
