-- Migration: Migrate Application to Multi-Schema Supabase Architecture

-- Step 1: Create new schemas
CREATE SCHEMA IF NOT EXISTS regular;
CREATE SCHEMA IF NOT EXISTS itr;
CREATE SCHEMA IF NOT EXISTS finance;

-- Step 2: Drop all existing constraints on public tables to be moved
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
          AND tc.table_schema = 'public'
          AND tc.table_name IN (
            'companies', 'companies_itr', 'company_main_accounts', 'company_main_accounts_itr',
            'company_main_sub_acc', 'company_main_sub_acc_itr', 'cash_book', 'cash_book_itr',
            'original_cash_book', 'original_cash_book_itr', 'edit_cash_book', 'edit_cash_book_itr',
            'deleted_cash_book', 'deleted_cash_book_itr', 'ledger', 'ledger_itr',
            'balance_sheet', 'balance_sheet_itr', 'vehicles', 'vehicles_itr',
            'drivers', 'drivers_itr', 'bank_guarantees', 'bank_guarantees_itr', 'reminders',
            'finance_partners', 'finance_customers', 'finance_loans', 'finance_transactions',
            'finance_capital_entries', 'finance_dues', 'finance_photos', 'finance_documents',
            'finance_edited_logs', 'finance_deleted_logs', 'finance_cashbook_accounts',
            'finance_cashbook_entries', 'finance_npa_records', 'finance_ledger_settings',
            'finance_loan_documents', 'finance_documents_returned', 'finance_fingerprints',
            'finance_cd_ledger_entries', 'finance_cd_interest_details', 'finance_guarantors'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;
END $$;

-- Step 3: Move Regular Tables to regular schema
ALTER TABLE IF EXISTS companies SET SCHEMA regular;
ALTER TABLE IF EXISTS company_main_accounts SET SCHEMA regular;
ALTER TABLE IF EXISTS company_main_sub_acc SET SCHEMA regular;
ALTER TABLE IF EXISTS cash_book SET SCHEMA regular;
ALTER TABLE IF EXISTS original_cash_book SET SCHEMA regular;
ALTER TABLE IF EXISTS edit_cash_book SET SCHEMA regular;
ALTER TABLE IF EXISTS deleted_cash_book SET SCHEMA regular;
ALTER TABLE IF EXISTS ledger SET SCHEMA regular;
ALTER TABLE IF EXISTS balance_sheet SET SCHEMA regular;
ALTER TABLE IF EXISTS vehicles SET SCHEMA regular;
ALTER TABLE IF EXISTS drivers SET SCHEMA regular;
ALTER TABLE IF EXISTS bank_guarantees SET SCHEMA regular;

-- Step 4: Move and Rename ITR Tables to itr schema
ALTER TABLE IF EXISTS companies_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.companies_itr RENAME TO companies;

ALTER TABLE IF EXISTS company_main_accounts_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.company_main_accounts_itr RENAME TO company_main_accounts;

ALTER TABLE IF EXISTS company_main_sub_acc_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.company_main_sub_acc_itr RENAME TO company_main_sub_acc;

ALTER TABLE IF EXISTS cash_book_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.cash_book_itr RENAME TO cash_book;

ALTER TABLE IF EXISTS original_cash_book_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.original_cash_book_itr RENAME TO original_cash_book;

ALTER TABLE IF EXISTS edit_cash_book_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.edit_cash_book_itr RENAME TO edit_cash_book;

ALTER TABLE IF EXISTS deleted_cash_book_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.deleted_cash_book_itr RENAME TO deleted_cash_book;

ALTER TABLE IF EXISTS ledger_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.ledger_itr RENAME TO ledger;

ALTER TABLE IF EXISTS balance_sheet_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.balance_sheet_itr RENAME TO balance_sheet;

ALTER TABLE IF EXISTS vehicles_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.vehicles_itr RENAME TO vehicles;

ALTER TABLE IF EXISTS drivers_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.drivers_itr RENAME TO drivers;

ALTER TABLE IF EXISTS bank_guarantees_itr SET SCHEMA itr;
ALTER TABLE IF EXISTS itr.bank_guarantees_itr RENAME TO bank_guarantees;

-- Step 5: Move and Rename Finance Tables to finance schema
ALTER TABLE IF EXISTS finance_user_permissions RENAME TO user_permissions;

ALTER TABLE IF EXISTS finance_partners SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_partners RENAME TO partners;

ALTER TABLE IF EXISTS finance_customers SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_customers RENAME TO borrowers;

ALTER TABLE IF EXISTS finance_loans SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_loans RENAME TO loans;

ALTER TABLE IF EXISTS finance_transactions SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_transactions RENAME TO loan_transactions;

ALTER TABLE IF EXISTS finance_capital_entries SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_capital_entries RENAME TO capital_entries;

ALTER TABLE IF EXISTS finance_dues SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_dues RENAME TO due_entries;

ALTER TABLE IF EXISTS finance_photos SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_photos RENAME TO photos;

ALTER TABLE IF EXISTS finance_documents SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_documents RENAME TO documents;

ALTER TABLE IF EXISTS finance_edited_logs SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_edited_logs RENAME TO edited_logs;

ALTER TABLE IF EXISTS finance_deleted_logs SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_deleted_logs RENAME TO deleted_logs;

ALTER TABLE IF EXISTS finance_cashbook_accounts SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_cashbook_accounts RENAME TO cashbook_accounts;

ALTER TABLE IF EXISTS finance_cashbook_entries SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_cashbook_entries RENAME TO cashbook_entries;

ALTER TABLE IF EXISTS finance_npa_records SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_npa_records RENAME TO npa_records;

ALTER TABLE IF EXISTS finance_ledger_settings SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_ledger_settings RENAME TO ledger_settings;

ALTER TABLE IF EXISTS finance_loan_documents SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_loan_documents RENAME TO loan_documents;

ALTER TABLE IF EXISTS finance_documents_returned SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_documents_returned RENAME TO documents_returned;

ALTER TABLE IF EXISTS finance_fingerprints SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_fingerprints RENAME TO fingerprints;

ALTER TABLE IF EXISTS finance_cd_ledger_entries SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_cd_ledger_entries RENAME TO cd_ledger_entries;

ALTER TABLE IF EXISTS finance_cd_interest_details SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_cd_interest_details RENAME TO cd_interest_details;

ALTER TABLE IF EXISTS finance_guarantors SET SCHEMA finance;
ALTER TABLE IF EXISTS finance.finance_guarantors RENAME TO guarantors;

-- Step 6: Split books and reminders tables

-- 6.1 Create Books Tables per mode
CREATE TABLE IF NOT EXISTS regular.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'itr')),
  start_date DATE,
  end_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  color VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE TABLE IF NOT EXISTS itr.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('regular', 'itr')),
  start_date DATE,
  end_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  color VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE TABLE IF NOT EXISTS finance.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  is_locked BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  color VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL
);

-- Copy books data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'books') THEN
    INSERT INTO regular.books 
    SELECT * FROM public.books 
    WHERE mode = 'regular'
    ON CONFLICT (book_code) DO NOTHING;

    INSERT INTO itr.books 
    SELECT * FROM public.books 
    WHERE mode = 'itr'
    ON CONFLICT (book_code) DO NOTHING;

    INSERT INTO finance.books (id, book_code, name, description, is_default, is_active, is_locked, is_archived, display_order, color, created_by, created_at, updated_at, deleted_at)
    SELECT id, book_code, name, description, is_default, is_active, is_locked, is_archived, display_order, color, created_by, created_at, updated_at, deleted_at 
    FROM public.books
    ON CONFLICT (book_code) DO NOTHING;
  END IF;
END $$;

-- 6.2 Create Reminders Tables per mode
CREATE TABLE IF NOT EXISTS regular.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME WITHOUT TIME ZONE,
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reminder_type VARCHAR(50) DEFAULT 'one_time' CHECK (reminder_type IN ('one_time', 'recurring')),
  recurring_interval VARCHAR(50) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  notify_before_days INTEGER DEFAULT 0,
  assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  mode VARCHAR(50) DEFAULT 'regular' CHECK (mode IN ('regular', 'itr')),
  category VARCHAR(100) DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'VEHICLE', 'LOAN', 'STAFF', 'DOCUMENT', 'TAX', 'MEETING', 'FOLLOWUP')),
  completion_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  is_system_generated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  book_id UUID REFERENCES regular.books(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS itr.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_time TIME WITHOUT TIME ZONE,
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reminder_type VARCHAR(50) DEFAULT 'one_time' CHECK (reminder_type IN ('one_time', 'recurring')),
  recurring_interval VARCHAR(50) CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  notify_before_days INTEGER DEFAULT 0,
  assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  mode VARCHAR(50) DEFAULT 'itr' CHECK (mode IN ('regular', 'itr')),
  category VARCHAR(100) DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'VEHICLE', 'LOAN', 'STAFF', 'DOCUMENT', 'TAX', 'MEETING', 'FOLLOWUP')),
  completion_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  snoozed_until TIMESTAMP WITH TIME ZONE,
  is_system_generated BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE NULL,
  book_id UUID REFERENCES itr.books(id) ON DELETE SET NULL
);

-- Copy reminders data
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'reminders') THEN
    INSERT INTO regular.reminders 
    SELECT * FROM public.reminders 
    WHERE mode = 'regular';

    INSERT INTO itr.reminders 
    SELECT * FROM public.reminders 
    WHERE mode = 'itr';
  END IF;
END $$;

-- Drop old books and reminders tables
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.books CASCADE;

-- 6.3 Create loan_types Table in finance schema
CREATE TABLE IF NOT EXISTS finance.loan_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Step 7: Apply constraints and references within schemas

-- 7.0 Drop existing constraints in target schemas to enable safe rerun/idempotence
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        WHERE tc.constraint_type IN ('FOREIGN KEY', 'UNIQUE')
          AND tc.table_schema IN ('regular', 'itr', 'finance')
          AND tc.table_name IN (
            'books', 'companies', 'company_main_accounts', 'company_main_sub_acc',
            'cash_book', 'original_cash_book', 'edit_cash_book', 'deleted_cash_book',
            'ledger', 'balance_sheet', 'vehicles', 'drivers', 'bank_guarantees',
            'reminders', 'partners', 'borrowers', 'loans', 'loan_transactions',
            'capital_entries', 'due_entries', 'photos', 'documents', 'edited_logs',
            'deleted_logs', 'cashbook_accounts', 'cashbook_entries', 'npa_records',
            'ledger_settings', 'loan_documents', 'documents_returned', 'fingerprints',
            'cd_ledger_entries', 'cd_interest_details', 'guarantors'
          )
    ) LOOP
        EXECUTE 'ALTER TABLE ' || quote_ident(r.table_schema) || '.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
    END LOOP;
END $$;

-- 7.1 Regular Schema Constraints
ALTER TABLE regular.companies ADD CONSTRAINT companies_company_name_book_id_key UNIQUE (company_name, book_id);
ALTER TABLE regular.company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_acc_name_book_id_key UNIQUE (company_name, acc_name, book_id);
ALTER TABLE regular.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_sub_acc_book_id_key UNIQUE (company_name, acc_name, sub_acc, book_id);

ALTER TABLE regular.companies ADD CONSTRAINT companies_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.company_main_accounts ADD CONSTRAINT company_main_accounts_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_book_id_fkey FOREIGN KEY (company_name, book_id) REFERENCES regular.companies(company_name, book_id) ON DELETE CASCADE;
ALTER TABLE regular.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_book_id_fkey FOREIGN KEY (company_name, acc_name, book_id) REFERENCES regular.company_main_accounts(company_name, acc_name, book_id) ON DELETE CASCADE;

ALTER TABLE regular.cash_book ADD CONSTRAINT cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.cash_book ADD CONSTRAINT cash_book_company_name_book_id_fkey FOREIGN KEY (company_name, book_id) REFERENCES regular.companies(company_name, book_id) ON DELETE SET NULL;

ALTER TABLE regular.original_cash_book ADD CONSTRAINT original_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.edit_cash_book ADD CONSTRAINT edit_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.deleted_cash_book ADD CONSTRAINT deleted_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.ledger ADD CONSTRAINT ledger_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.balance_sheet ADD CONSTRAINT balance_sheet_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.vehicles ADD CONSTRAINT vehicles_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.drivers ADD CONSTRAINT drivers_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;
ALTER TABLE regular.bank_guarantees ADD CONSTRAINT bank_guarantees_book_id_fkey FOREIGN KEY (book_id) REFERENCES regular.books(id) ON DELETE SET NULL;

ALTER TABLE regular.vehicles ADD CONSTRAINT vehicles_v_no_book_id_key UNIQUE (v_no, book_id);
ALTER TABLE regular.drivers ADD CONSTRAINT drivers_license_no_book_id_key UNIQUE (license_no, book_id);
ALTER TABLE regular.bank_guarantees ADD CONSTRAINT bank_guarantees_bg_no_book_id_key UNIQUE (bg_no, book_id);
ALTER TABLE regular.balance_sheet ADD CONSTRAINT balance_sheet_acc_name_book_id_key UNIQUE (acc_name, book_id);

-- 7.2 ITR Schema Constraints
ALTER TABLE itr.companies ADD CONSTRAINT companies_company_name_book_id_key UNIQUE (company_name, book_id);
ALTER TABLE itr.company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_acc_name_book_id_key UNIQUE (company_name, acc_name, book_id);
ALTER TABLE itr.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_sub_acc_book_id_key UNIQUE (company_name, acc_name, sub_acc, book_id);

ALTER TABLE itr.companies ADD CONSTRAINT companies_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.company_main_accounts ADD CONSTRAINT company_main_accounts_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_book_id_fkey FOREIGN KEY (company_name, book_id) REFERENCES itr.companies(company_name, book_id) ON DELETE CASCADE;
ALTER TABLE itr.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_book_id_fkey FOREIGN KEY (company_name, acc_name, book_id) REFERENCES itr.company_main_accounts(company_name, acc_name, book_id) ON DELETE CASCADE;

ALTER TABLE itr.cash_book ADD CONSTRAINT cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.cash_book ADD CONSTRAINT cash_book_company_name_book_id_fkey FOREIGN KEY (company_name, book_id) REFERENCES itr.companies(company_name, book_id) ON DELETE SET NULL;

ALTER TABLE itr.original_cash_book ADD CONSTRAINT original_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.edit_cash_book ADD CONSTRAINT edit_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.deleted_cash_book ADD CONSTRAINT deleted_cash_book_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.ledger ADD CONSTRAINT ledger_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.balance_sheet ADD CONSTRAINT balance_sheet_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.vehicles ADD CONSTRAINT vehicles_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.drivers ADD CONSTRAINT drivers_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;
ALTER TABLE itr.bank_guarantees ADD CONSTRAINT bank_guarantees_book_id_fkey FOREIGN KEY (book_id) REFERENCES itr.books(id) ON DELETE SET NULL;

ALTER TABLE itr.vehicles ADD CONSTRAINT vehicles_v_no_book_id_key UNIQUE (v_no, book_id);
ALTER TABLE itr.drivers ADD CONSTRAINT drivers_license_no_book_id_key UNIQUE (license_no, book_id);
ALTER TABLE itr.bank_guarantees ADD CONSTRAINT bank_guarantees_bg_no_book_id_key UNIQUE (bg_no, book_id);
ALTER TABLE itr.balance_sheet ADD CONSTRAINT balance_sheet_acc_name_book_id_key UNIQUE (acc_name, book_id);

-- 7.3 Finance Schema Constraints
ALTER TABLE finance.partners ADD CONSTRAINT partners_name_book_id_key UNIQUE (name, book_id);
ALTER TABLE finance.borrowers ADD CONSTRAINT borrowers_aadhaar_book_id_key UNIQUE (aadhaar, book_id);
ALTER TABLE finance.loans ADD CONSTRAINT loans_loan_id_book_id_key UNIQUE (loan_id, book_id);

ALTER TABLE finance.loans ADD CONSTRAINT loans_book_id_fkey FOREIGN KEY (book_id) REFERENCES finance.books(id) ON DELETE SET NULL;
ALTER TABLE finance.loans ADD CONSTRAINT loans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES finance.borrowers(id) ON DELETE CASCADE;

ALTER TABLE finance.loan_transactions ADD CONSTRAINT loan_transactions_book_id_fkey FOREIGN KEY (book_id) REFERENCES finance.books(id) ON DELETE SET NULL;
ALTER TABLE finance.loan_transactions ADD CONSTRAINT loan_transactions_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;

ALTER TABLE finance.capital_entries ADD CONSTRAINT capital_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES finance.books(id) ON DELETE SET NULL;
ALTER TABLE finance.capital_entries ADD CONSTRAINT capital_entries_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES finance.partners(id) ON DELETE CASCADE;

ALTER TABLE finance.due_entries ADD CONSTRAINT due_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES finance.books(id) ON DELETE SET NULL;
ALTER TABLE finance.due_entries ADD CONSTRAINT due_entries_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;

ALTER TABLE finance.photos ADD CONSTRAINT photos_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;
ALTER TABLE finance.documents ADD CONSTRAINT documents_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;
ALTER TABLE finance.loan_documents ADD CONSTRAINT loan_documents_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;
ALTER TABLE finance.documents_returned ADD CONSTRAINT documents_returned_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;
ALTER TABLE finance.fingerprints ADD CONSTRAINT fingerprints_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;

ALTER TABLE finance.cd_ledger_entries ADD CONSTRAINT cd_ledger_entries_book_id_fkey FOREIGN KEY (book_id) REFERENCES finance.books(id) ON DELETE SET NULL;
ALTER TABLE finance.cd_ledger_entries ADD CONSTRAINT cd_ledger_entries_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;
ALTER TABLE finance.cd_ledger_entries ADD CONSTRAINT cd_ledger_entries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES finance.borrowers(id) ON DELETE CASCADE;

ALTER TABLE finance.cd_interest_details ADD CONSTRAINT cd_interest_details_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES finance.loans(id) ON DELETE CASCADE;

-- Step 8: Grant schema usage and privileges to PostgREST roles (anon, authenticated, service_role)
GRANT USAGE ON SCHEMA regular, itr, finance TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA regular, itr, finance TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA regular, itr, finance TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA regular, itr, finance TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA regular, itr, finance GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA regular, itr, finance GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA regular, itr, finance GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
