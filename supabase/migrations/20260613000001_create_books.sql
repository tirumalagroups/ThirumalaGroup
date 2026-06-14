-- Step 1: Create books table
CREATE TABLE IF NOT EXISTS books (
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

-- Disable RLS (Row Level Security) on books to match standard local auth flow
ALTER TABLE books DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_books_mode ON books(mode);
CREATE INDEX IF NOT EXISTS idx_books_book_code ON books(book_code);
CREATE INDEX IF NOT EXISTS idx_books_is_active ON books(is_active);
CREATE INDEX IF NOT EXISTS idx_books_is_locked ON books(is_locked);


-- Step 2 & 3: Seed legacy books & dynamically assign existing records inside a transaction block
DO $$
DECLARE
  v_reg_book_id UUID := gen_random_uuid();
  v_itr_book_id UUID := gen_random_uuid();
  v_table_name text;
  r RECORD;
BEGIN
  -- Insert Regular Legacy Book
  INSERT INTO books (id, book_code, name, description, mode, is_default, is_active, is_locked, is_archived, display_order, color)
  VALUES (v_reg_book_id, 'REG-LEGACY', 'Regular Legacy Data', 'Regular Mode Legacy accounting book', 'regular', TRUE, TRUE, FALSE, FALSE, 0, '#3b82f6')
  ON CONFLICT (book_code) DO UPDATE 
  SET is_default = TRUE
  RETURNING id INTO v_reg_book_id;
  
  -- Insert ITR Legacy Book
  INSERT INTO books (id, book_code, name, description, mode, is_default, is_active, is_locked, is_archived, display_order, color)
  VALUES (v_itr_book_id, 'ITR-LEGACY', 'ITR Legacy Data', 'ITR Mode Legacy accounting book', 'itr', TRUE, TRUE, FALSE, FALSE, 0, '#10b981')
  ON CONFLICT (book_code) DO UPDATE 
  SET is_default = TRUE
  RETURNING id INTO v_itr_book_id;

  -- Step 4 & 5: Add book_id column to tables, populate with legacy books, and drop constraints
  
  -- Dynamic Dropping of Foreign Keys and Unique Constraints for scoped tables to avoid hardcoding naming differences.
  -- 1. Regular Master Tables
  -- Drop foreign keys on company_main_sub_acc
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_sub_acc' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_sub_acc DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on company_main_sub_acc
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_sub_acc' AND tc.constraint_type = 'UNIQUE'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_sub_acc DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop foreign keys on company_main_accounts
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_accounts' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_accounts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on company_main_accounts
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_accounts' AND tc.constraint_type = 'UNIQUE'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_accounts DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on companies
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'companies' AND (tc.constraint_type = 'UNIQUE' OR tc.constraint_type = 'PRIMARY KEY') AND tc.constraint_name <> 'companies_pkey'
  ) LOOP
    EXECUTE 'ALTER TABLE companies DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;
  -- Also drop any unique index if exists on companies(company_name)
  EXECUTE 'ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_name_key CASCADE';

  -- 2. ITR Master Tables
  -- Drop foreign keys on company_main_sub_acc_itr
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_sub_acc_itr' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_sub_acc_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on company_main_sub_acc_itr
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_sub_acc_itr' AND tc.constraint_type = 'UNIQUE'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_sub_acc_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop foreign keys on company_main_accounts_itr
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_accounts_itr' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_accounts_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on company_main_accounts_itr
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'company_main_accounts_itr' AND tc.constraint_type = 'UNIQUE'
  ) LOOP
    EXECUTE 'ALTER TABLE company_main_accounts_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- Drop unique constraints on companies_itr
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'companies_itr' AND (tc.constraint_type = 'UNIQUE' OR tc.constraint_type = 'PRIMARY KEY') AND tc.constraint_name <> 'companies_itr_pkey'
  ) LOOP
    EXECUTE 'ALTER TABLE companies_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;
  EXECUTE 'ALTER TABLE companies_itr DROP CONSTRAINT IF EXISTS companies_itr_company_name_key CASCADE';

  -- 3. Cash Book Foreign Keys
  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'cash_book' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE cash_book DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  FOR r IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'cash_book_itr' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE cash_book_itr DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name) || ' CASCADE';
  END LOOP;

  -- 4. Other Unique Constraints
  EXECUTE 'ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_v_no_key CASCADE';
  EXECUTE 'ALTER TABLE vehicles_itr DROP CONSTRAINT IF EXISTS vehicles_itr_v_no_key CASCADE';
  EXECUTE 'ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_license_no_key CASCADE';
  EXECUTE 'ALTER TABLE drivers_itr DROP CONSTRAINT IF EXISTS drivers_itr_license_no_key CASCADE';
  EXECUTE 'ALTER TABLE bank_guarantees DROP CONSTRAINT IF EXISTS bank_guarantees_bg_no_key CASCADE';
  EXECUTE 'ALTER TABLE bank_guarantees_itr DROP CONSTRAINT IF EXISTS bank_guarantees_itr_bg_no_key CASCADE';
  EXECUTE 'ALTER TABLE balance_sheet DROP CONSTRAINT IF EXISTS balance_sheet_acc_name_key CASCADE';
  EXECUTE 'ALTER TABLE balance_sheet_itr DROP CONSTRAINT IF EXISTS balance_sheet_itr_acc_name_key CASCADE';
  
  -- 5. Finance Unique Constraints
  EXECUTE 'ALTER TABLE finance_partners DROP CONSTRAINT IF EXISTS finance_partners_name_key CASCADE';
  EXECUTE 'ALTER TABLE finance_customers DROP CONSTRAINT IF EXISTS finance_customers_aadhaar_key CASCADE';
  EXECUTE 'ALTER TABLE finance_loans DROP CONSTRAINT IF EXISTS finance_loans_loan_id_key CASCADE';

END $$;


-- Add book_id to all scoped tables
ALTER TABLE companies ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE companies_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE company_main_accounts ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE company_main_accounts_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE company_main_sub_acc ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE company_main_sub_acc_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE cash_book ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE cash_book_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE original_cash_book ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE original_cash_book_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE edit_cash_book ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE edit_cash_book_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE deleted_cash_book ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE deleted_cash_book_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE ledger ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE ledger_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE balance_sheet ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE balance_sheet_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE vehicles_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE drivers_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE bank_guarantees ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE bank_guarantees_itr ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE reminders ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;

ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_customers ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_capital_entries ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_dues ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_cd_ledger_entries ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;
ALTER TABLE finance_cashbook_entries ADD COLUMN IF NOT EXISTS book_id UUID REFERENCES books(id) ON DELETE SET NULL;


-- Populate tables with correct legacy book_id
DO $$
DECLARE
  v_reg_book_id UUID;
  v_itr_book_id UUID;
BEGIN
  SELECT id INTO v_reg_book_id FROM books WHERE book_code = 'REG-LEGACY';
  SELECT id INTO v_itr_book_id FROM books WHERE book_code = 'ITR-LEGACY';

  -- Update Regular Tables
  UPDATE companies SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE company_main_accounts SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE company_main_sub_acc SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE cash_book SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE original_cash_book SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE edit_cash_book SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE deleted_cash_book SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE ledger SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE balance_sheet SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE vehicles SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE drivers SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE bank_guarantees SET book_id = v_reg_book_id WHERE book_id IS NULL;
  
  -- Update ITR Tables
  UPDATE companies_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE company_main_accounts_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE company_main_sub_acc_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE cash_book_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE original_cash_book_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE edit_cash_book_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE deleted_cash_book_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE ledger_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE balance_sheet_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE vehicles_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE drivers_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;
  UPDATE bank_guarantees_itr SET book_id = v_itr_book_id WHERE book_id IS NULL;

  -- Update Reminders by mode
  UPDATE reminders SET book_id = v_reg_book_id WHERE mode = 'regular' AND book_id IS NULL;
  UPDATE reminders SET book_id = v_itr_book_id WHERE mode = 'itr' AND book_id IS NULL;

  -- Update Finance Tables (using REG-LEGACY)
  UPDATE finance_partners SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_customers SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_loans SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_transactions SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_capital_entries SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_dues SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_cd_ledger_entries SET book_id = v_reg_book_id WHERE book_id IS NULL;
  UPDATE finance_cashbook_entries SET book_id = v_reg_book_id WHERE book_id IS NULL;
END $$;


-- Deduplicate records before applying unique constraints to prevent "23505 duplicate key" errors
DELETE FROM companies WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, book_id ORDER BY created_at DESC) as rn FROM companies
  ) t WHERE t.rn > 1
);
DELETE FROM companies_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, book_id ORDER BY created_at DESC) as rn FROM companies_itr
  ) t WHERE t.rn > 1
);

DELETE FROM company_main_accounts WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, acc_name, book_id ORDER BY created_at DESC) as rn FROM company_main_accounts
  ) t WHERE t.rn > 1
);
DELETE FROM company_main_accounts_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, acc_name, book_id ORDER BY created_at DESC) as rn FROM company_main_accounts_itr
  ) t WHERE t.rn > 1
);

DELETE FROM company_main_sub_acc WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, acc_name, sub_acc, book_id ORDER BY created_at DESC) as rn FROM company_main_sub_acc
  ) t WHERE t.rn > 1
);
DELETE FROM company_main_sub_acc_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY company_name, acc_name, sub_acc, book_id ORDER BY created_at DESC) as rn FROM company_main_sub_acc_itr
  ) t WHERE t.rn > 1
);

DELETE FROM vehicles WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY v_no, book_id ORDER BY created_at DESC) as rn FROM vehicles
  ) t WHERE t.rn > 1
);
DELETE FROM vehicles_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY v_no, book_id ORDER BY created_at DESC) as rn FROM vehicles_itr
  ) t WHERE t.rn > 1
);

DELETE FROM drivers WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY license_no, book_id ORDER BY created_at DESC) as rn FROM drivers
  ) t WHERE t.rn > 1
);
DELETE FROM drivers_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY license_no, book_id ORDER BY created_at DESC) as rn FROM drivers_itr
  ) t WHERE t.rn > 1
);

DELETE FROM bank_guarantees WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY bg_no, book_id ORDER BY created_at DESC) as rn FROM bank_guarantees
  ) t WHERE t.rn > 1
);
DELETE FROM bank_guarantees_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY bg_no, book_id ORDER BY created_at DESC) as rn FROM bank_guarantees_itr
  ) t WHERE t.rn > 1
);

DELETE FROM balance_sheet WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY acc_name, book_id ORDER BY created_at DESC) as rn FROM balance_sheet
  ) t WHERE t.rn > 1
);
DELETE FROM balance_sheet_itr WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY acc_name, book_id ORDER BY created_at DESC) as rn FROM balance_sheet_itr
  ) t WHERE t.rn > 1
);

DELETE FROM finance_partners WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY name, book_id ORDER BY created_at DESC) as rn FROM finance_partners
  ) t WHERE t.rn > 1
);
DELETE FROM finance_customers WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY aadhaar, book_id ORDER BY created_at DESC) as rn FROM finance_customers
  ) t WHERE t.rn > 1
);
DELETE FROM finance_loans WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY loan_id, book_id ORDER BY created_at DESC) as rn FROM finance_loans
  ) t WHERE t.rn > 1
);


-- Set book_id NOT NULL for tables where it should be mandatory
ALTER TABLE companies ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE companies_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE company_main_accounts ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE company_main_accounts_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE company_main_sub_acc ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE company_main_sub_acc_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE cash_book ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE cash_book_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE ledger ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE ledger_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE balance_sheet ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE balance_sheet_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE vehicles ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE vehicles_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE drivers ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE drivers_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE bank_guarantees ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE bank_guarantees_itr ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE reminders ALTER COLUMN book_id SET NOT NULL;

ALTER TABLE finance_partners ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_customers ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_loans ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_transactions ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_capital_entries ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_dues ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_cd_ledger_entries ALTER COLUMN book_id SET NOT NULL;
ALTER TABLE finance_cashbook_entries ALTER COLUMN book_id SET NOT NULL;


-- Apply new unique constraints and composite keys
-- 1. Regular Master Keys
ALTER TABLE companies ADD CONSTRAINT companies_company_name_book_id_key UNIQUE (company_name, book_id);
ALTER TABLE company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_acc_name_book_id_key UNIQUE (company_name, acc_name, book_id);
ALTER TABLE company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_sub_acc_book_id_key UNIQUE (company_name, acc_name, sub_acc, book_id);

ALTER TABLE company_main_accounts ADD CONSTRAINT company_main_accounts_company_name_book_id_fkey 
  FOREIGN KEY (company_name, book_id) REFERENCES companies (company_name, book_id) ON DELETE CASCADE;
ALTER TABLE company_main_sub_acc ADD CONSTRAINT company_main_sub_acc_company_name_acc_name_book_id_fkey 
  FOREIGN KEY (company_name, acc_name, book_id) REFERENCES company_main_accounts (company_name, acc_name, book_id) ON DELETE CASCADE;

-- 2. ITR Master Keys
ALTER TABLE companies_itr ADD CONSTRAINT companies_itr_company_name_book_id_key UNIQUE (company_name, book_id);
ALTER TABLE company_main_accounts_itr ADD CONSTRAINT company_main_accounts_itr_company_name_acc_name_book_id_key UNIQUE (company_name, acc_name, book_id);
ALTER TABLE company_main_sub_acc_itr ADD CONSTRAINT company_main_sub_acc_itr_company_name_acc_name_sub_acc_book_id UNIQUE (company_name, acc_name, sub_acc, book_id);

ALTER TABLE company_main_accounts_itr ADD CONSTRAINT company_main_accounts_itr_company_name_book_id_fkey 
  FOREIGN KEY (company_name, book_id) REFERENCES companies_itr (company_name, book_id) ON DELETE CASCADE;
ALTER TABLE company_main_sub_acc_itr ADD CONSTRAINT company_main_sub_acc_itr_company_name_acc_name_book_id_fkey 
  FOREIGN KEY (company_name, acc_name, book_id) REFERENCES company_main_accounts_itr (company_name, acc_name, book_id) ON DELETE CASCADE;

-- 3. Cash Book Foreign Keys Scoped by Book
ALTER TABLE cash_book ADD CONSTRAINT cash_book_company_name_book_id_fkey 
  FOREIGN KEY (company_name, book_id) REFERENCES companies (company_name, book_id) ON DELETE SET NULL;
ALTER TABLE cash_book_itr ADD CONSTRAINT cash_book_itr_company_name_book_id_fkey 
  FOREIGN KEY (company_name, book_id) REFERENCES companies_itr (company_name, book_id) ON DELETE SET NULL;

-- 4. Scope other unique constraints by book
ALTER TABLE vehicles ADD CONSTRAINT vehicles_v_no_book_id_key UNIQUE (v_no, book_id);
ALTER TABLE vehicles_itr ADD CONSTRAINT vehicles_itr_v_no_book_id_key UNIQUE (v_no, book_id);

ALTER TABLE drivers ADD CONSTRAINT drivers_license_no_book_id_key UNIQUE (license_no, book_id);
ALTER TABLE drivers_itr ADD CONSTRAINT drivers_itr_license_no_book_id_key UNIQUE (license_no, book_id);

ALTER TABLE bank_guarantees ADD CONSTRAINT bank_guarantees_bg_no_book_id_key UNIQUE (bg_no, book_id);
ALTER TABLE bank_guarantees_itr ADD CONSTRAINT bank_guarantees_itr_bg_no_book_id_key UNIQUE (bg_no, book_id);

ALTER TABLE balance_sheet ADD CONSTRAINT balance_sheet_acc_name_book_id_key UNIQUE (acc_name, book_id);
ALTER TABLE balance_sheet_itr ADD CONSTRAINT balance_sheet_itr_acc_name_book_id_key UNIQUE (acc_name, book_id);

-- 5. Scope finance constraints by book
ALTER TABLE finance_partners ADD CONSTRAINT finance_partners_name_book_id_key UNIQUE (name, book_id);
ALTER TABLE finance_customers ADD CONSTRAINT finance_customers_aadhaar_book_id_key UNIQUE (aadhaar, book_id);
ALTER TABLE finance_loans ADD CONSTRAINT finance_loans_loan_id_book_id_key UNIQUE (loan_id, book_id);


-- Seed feature key
INSERT INTO features (key, name)
VALUES ('book_management', 'Book Management')
ON CONFLICT (key) DO NOTHING;
