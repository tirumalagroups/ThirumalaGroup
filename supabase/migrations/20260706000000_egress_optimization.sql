-- PostgreSQL Migration: 20260706000000_egress_optimization.sql
-- Description: Create indexes and RPC functions to optimize query egress and eliminate N+1 patterns

-- 1. Create performance-critical indexes
CREATE INDEX IF NOT EXISTS idx_cd_ledger_entries_loan_id_type 
ON finance.cd_ledger_entries (loan_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_cd_interest_details_loan_id 
ON finance.cd_interest_details (loan_id);

CREATE INDEX IF NOT EXISTS idx_due_entries_loan_id_status 
ON finance.due_entries (loan_id, status);

CREATE INDEX IF NOT EXISTS idx_loan_transactions_loan_id_type 
ON finance.loan_transactions (loan_id, type);

CREATE INDEX IF NOT EXISTS idx_loans_status_category 
ON finance.loans (status, loan_category);

-- 2. get_active_loan_dues_summary RPC
CREATE OR REPLACE FUNCTION finance.get_active_loan_dues_summary(today_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  id uuid,
  loan_id text,
  customer_name text,
  loan_category text,
  loan_type text,
  loan_amount numeric,
  current_principal numeric,
  loan_date date,
  current_due_date date,
  interest_paid numeric,
  pending_interest numeric,
  penalty numeric,
  present_due numeric,
  due_days integer,
  is_npa boolean,
  phone text,
  g1_name text,
  g1_phone text,
  g2_name text,
  g2_phone text,
  partner_name text
) AS $$
BEGIN
  RETURN QUERY
  WITH loan_base AS (
    SELECT 
      l.id AS l_id,
      l.loan_id AS l_loan_id,
      c.name AS c_name,
      l.loan_category AS l_category,
      CASE 
        WHEN l.loan_id LIKE 'CD%' THEN 'CD'
        WHEN l.loan_id LIKE 'HP%' THEN 'HP'
        WHEN l.loan_id LIKE 'STBD%' THEN 'STBD'
        ELSE 'TBD'
      END AS l_type,
      l.amount AS l_amount,
      l.date AS l_date,
      l.interest_rate AS l_interest_rate,
      l.duration_months AS l_duration_months,
      l.period_days AS l_period_days,
      l.grace_days AS l_grace_days,
      l.penalty_percent AS l_penalty_percent,
      COALESCE(c.phone, c.phone_1, c.phone_2, '') AS c_phone,
      COALESCE(g1.name, '') AS g1_n,
      COALESCE(g1.phone, g1.phone_1, g1.phone_2, '') AS g1_p,
      COALESCE(g2.name, '') AS g2_n,
      COALESCE(g2.phone, g2.phone_1, g2.phone_2, '') AS g2_p,
      COALESCE(c.partner_name, 'Unassigned') AS p_name
    FROM finance.loans l
    LEFT JOIN finance.borrowers c ON l.customer_id = c.id
    LEFT JOIN finance.borrowers g1 ON l.guarantor_1_id = g1.id
    LEFT JOIN finance.borrowers g2 ON l.guarantor_2_id = g2.id
    WHERE l.status = 'Active'
  ),
  cd_calculations AS (
    SELECT
      lb.l_id,
      -- Principal Balance (debit - credit)
      COALESCE((
        SELECT SUM(e.debit) 
        FROM finance.cd_ledger_entries e 
        WHERE e.loan_id = lb.l_id AND e.entry_type IN ('original_loan', 'Disbursement')
      ), 0) -
      COALESCE((
        SELECT SUM(e.credit) 
        FROM finance.cd_ledger_entries e 
        WHERE e.loan_id = lb.l_id AND (e.entry_type = 'principal_payment' OR e.account_name = 'CD A/C')
      ), 0) AS principal_balance,
      -- Original Loan Date
      COALESCE((
        SELECT MIN(e.entry_date) 
        FROM finance.cd_ledger_entries e 
        WHERE e.loan_id = lb.l_id AND e.entry_type IN ('original_loan', 'Disbursement')
      ), lb.l_date) AS original_loan_date,
      -- Period Days
      COALESCE(lb.l_period_days, 30) AS period_days,
      -- Total Renewed Days
      COALESCE((
        SELECT SUM(d.renewed_days) 
        FROM finance.cd_interest_details d 
        WHERE d.loan_id = lb.l_id AND d.credit = 0
      ), 0) AS total_renewed_days,
      -- Interest Paid
      COALESCE((
        SELECT SUM(e.credit) 
        FROM finance.cd_ledger_entries e 
        WHERE e.loan_id = lb.l_id AND (e.account_name = 'CD COMMISSION A/C' OR e.entry_type = 'interest_payment')
      ), 0) AS interest_paid
    FROM loan_base lb
    WHERE lb.l_type = 'CD'
  ),
  cd_final AS (
    SELECT
      lb.l_id,
      cc.principal_balance,
      cc.original_loan_date,
      -- base_due_date = original_loan_date + period_days - 1
      -- current_due_date = base_due_date + total_renewed_days
      (cc.original_loan_date + (cc.period_days - 1)::integer + cc.total_renewed_days::integer) AS current_due_date,
      cc.interest_paid
    FROM loan_base lb
    JOIN cd_calculations cc ON lb.l_id = cc.l_id
  )
  SELECT 
    lb.l_id AS id,
    lb.l_loan_id AS loan_id,
    lb.c_name AS customer_name,
    lb.l_category AS loan_category,
    lb.l_type AS loan_type,
    lb.l_amount AS loan_amount,
    -- current_principal
    CASE 
      WHEN lb.l_type = 'CD' THEN (SELECT cf.principal_balance FROM cd_final cf WHERE cf.l_id = lb.l_id)
      ELSE 
        -- HP/STBD/TBD current_principal calculation
        COALESCE((
          WITH due_sums AS (
            SELECT 
              COALESCE(SUM(amount), 0) AS total_repayable,
              COALESCE(SUM(paid_amount), 0) AS total_paid
            FROM finance.due_entries
            WHERE loan_id = lb.l_id
          )
          SELECT 
            CASE 
              WHEN total_repayable > 0 THEN 
                lb.l_amount - (total_paid * (1.0 - ((total_repayable - lb.l_amount) / total_repayable)))
              ELSE lb.l_amount
            END
          FROM due_sums
        ), lb.l_amount)
    END AS current_principal,
    -- loan_date
    CASE 
      WHEN lb.l_type = 'CD' THEN (SELECT cf.original_loan_date FROM cd_final cf WHERE cf.l_id = lb.l_id)
      ELSE lb.l_date
    END AS loan_date,
    -- current_due_date
    CASE 
      WHEN lb.l_type = 'CD' THEN (SELECT cf.current_due_date FROM cd_final cf WHERE cf.l_id = lb.l_id)
      ELSE 
        COALESCE((
          SELECT MIN(due_date)
          FROM finance.due_entries
          WHERE loan_id = lb.l_id AND status != 'Paid'
        ), lb.l_date)
    END AS current_due_date,
    -- interest_paid
    CASE 
      WHEN lb.l_type = 'CD' THEN (SELECT cf.interest_paid FROM cd_final cf WHERE cf.l_id = lb.l_id)
      ELSE 
        COALESCE((
          WITH due_sums AS (
            SELECT 
              COALESCE(SUM(amount), 0) AS total_repayable,
              COALESCE(SUM(paid_amount), 0) AS total_paid
            FROM finance.due_entries
            WHERE loan_id = lb.l_id
          )
          SELECT 
            CASE 
              WHEN total_repayable > 0 THEN 
                total_paid * ((total_repayable - lb.l_amount) / total_repayable)
              ELSE 0
            END
          FROM due_sums
        ), 0)
    END AS interest_paid,
    -- pending_interest
    CASE 
      WHEN lb.l_type = 'CD' THEN
        (
          WITH cf AS (SELECT * FROM cd_final WHERE cf.l_id = lb.l_id),
               days AS (SELECT today_date - (SELECT cf.current_due_date FROM cf) AS due_days)
          SELECT 
            CASE 
              WHEN (SELECT due_days FROM days) > 0 THEN 
                ROUND(((SELECT cf.principal_balance FROM cf) * lb.l_interest_rate * (SELECT due_days FROM days)) / COALESCE(lb.l_period_days, 30) / 100.0, 2)
              ELSE 0
            END
        )
      ELSE 
        COALESCE((
          WITH due_sums AS (
            SELECT 
              COALESCE(SUM(amount), 0) AS total_repayable,
              COALESCE(SUM(amount - paid_amount), 0) AS present_due
            FROM finance.due_entries
            WHERE loan_id = lb.l_id AND due_date <= today_date AND status != 'Paid'
          )
          SELECT 
            CASE 
              WHEN total_repayable > 0 THEN 
                present_due * ((total_repayable - lb.l_amount) / total_repayable)
              ELSE 0
            END
          FROM due_sums
        ), 0)
    END AS pending_interest,
    -- penalty
    CASE 
      WHEN lb.l_type = 'CD' THEN
        (
          WITH cf AS (SELECT * FROM cd_final WHERE cf.l_id = lb.l_id),
               days AS (SELECT today_date - (SELECT cf.current_due_date FROM cf) AS due_days)
          SELECT 
            CASE 
              WHEN (SELECT due_days FROM days) > COALESCE(lb.l_grace_days, 5) THEN 
                ROUND(((SELECT cf.principal_balance FROM cf) * COALESCE(lb.l_penalty_percent, 0.75) * (SELECT due_days FROM days)) / COALESCE(lb.l_period_days, 30) / 100.0, 2)
              ELSE 0
            END
        )
      ELSE 
        COALESCE((
          WITH oldest AS (
            SELECT MIN(due_date) AS oldest_date
            FROM finance.due_entries
            WHERE loan_id = lb.l_id AND status != 'Paid'
          ),
          days AS (
            SELECT today_date - oldest_date AS due_days
            FROM oldest
            WHERE oldest_date IS NOT NULL
          ),
          present AS (
            SELECT COALESCE(SUM(amount - paid_amount), 0) AS present_due
            FROM finance.due_entries
            WHERE loan_id = lb.l_id AND due_date <= today_date AND status != 'Paid'
          ),
          setting AS (
            SELECT ls.overdue, ls.days_per_year
            FROM finance.ledger_settings ls
            WHERE ls.code = lb.l_category
            UNION ALL
            SELECT ls.overdue, ls.days_per_year
            FROM finance.ledger_settings ls
            WHERE ls.code = 'CD'
            LIMIT 1
          )
          SELECT 
            CASE 
              WHEN (SELECT due_days FROM days) > 5 THEN
                ROUND((SELECT present_due FROM present) * ((SELECT overdue FROM setting) / 100.0) * ((SELECT due_days FROM days) / ((SELECT days_per_year FROM setting)::numeric / 12.0)), 0)
              ELSE 0
            END
          FROM setting
          WHERE EXISTS (SELECT 1 FROM days)
        ), 0)
    END AS penalty,
    -- present_due
    CASE 
      WHEN lb.l_type = 'CD' THEN
        (
          WITH cf AS (SELECT * FROM cd_final WHERE cf.l_id = lb.l_id),
               days AS (SELECT today_date - (SELECT cf.current_due_date FROM cf) AS due_days),
               pi AS (
                 SELECT 
                   CASE 
                     WHEN (SELECT due_days FROM days) > 0 THEN 
                       ROUND(((SELECT cf.principal_balance FROM cf) * lb.l_interest_rate * (SELECT due_days FROM days)) / COALESCE(lb.l_period_days, 30) / 100.0, 2)
                     ELSE 0
                   END AS val
               ),
               pen AS (
                 SELECT 
                   CASE 
                     WHEN (SELECT due_days FROM days) > COALESCE(lb.l_grace_days, 5) THEN 
                       ROUND(((SELECT cf.principal_balance FROM cf) * COALESCE(lb.l_penalty_percent, 0.75) * (SELECT due_days FROM days)) / COALESCE(lb.l_period_days, 30) / 100.0, 2)
                     ELSE 0
                   END AS val
               )
          SELECT (SELECT val FROM pi) + (SELECT val FROM pen)
        )
      ELSE 
        COALESCE((
          WITH oldest AS (
            SELECT MIN(due_date) AS oldest_date
            FROM finance.due_entries
            WHERE loan_id = lb.l_id AND status != 'Paid'
          ),
          days AS (
            SELECT today_date - oldest_date AS due_days
            FROM oldest
            WHERE oldest_date IS NOT NULL
          ),
          present AS (
            SELECT COALESCE(SUM(amount - paid_amount), 0) AS present_due
            FROM finance.due_entries
            WHERE loan_id = lb.l_id AND due_date <= today_date AND status != 'Paid'
          ),
          setting AS (
            SELECT ls.overdue, ls.days_per_year
            FROM finance.ledger_settings ls
            WHERE ls.code = lb.l_category
            UNION ALL
            SELECT ls.overdue, ls.days_per_year
            FROM finance.ledger_settings ls
            WHERE ls.code = 'CD'
            LIMIT 1
          ),
          pen AS (
            SELECT 
              CASE 
                WHEN (SELECT due_days FROM days) > 5 THEN
                  ROUND((SELECT present_due FROM present) * ((SELECT overdue FROM setting) / 100.0) * ((SELECT due_days FROM days) / ((SELECT days_per_year FROM setting)::numeric / 12.0)), 0)
                ELSE 0
              END AS val
            FROM setting
            WHERE EXISTS (SELECT 1 FROM days)
          )
          SELECT (SELECT present_due FROM present) + COALESCE((SELECT val FROM pen), 0)
        ), 0)
    END AS present_due,
    -- due_days
    CASE 
      WHEN lb.l_type = 'CD' THEN 
        COALESCE(GREATEST(0, today_date - (SELECT cf.current_due_date FROM cd_final cf WHERE cf.l_id = lb.l_id)), 0)
      ELSE 
        COALESCE(GREATEST(0, today_date - (SELECT MIN(due_date) FROM finance.due_entries WHERE loan_id = lb.l_id AND status != 'Paid')), 0)
    END AS due_days,
    -- is_npa
    CASE 
      WHEN lb.l_type = 'CD' THEN 
        COALESCE((today_date - (SELECT cf.current_due_date FROM cd_final cf WHERE cf.l_id = lb.l_id)) > 90, false)
      ELSE 
        COALESCE((today_date - (SELECT MIN(due_date) FROM finance.due_entries WHERE loan_id = lb.l_id AND status != 'Paid')) > 90, false)
    END AS is_npa,
    lb.c_phone AS phone,
    lb.g1_n AS g1_name,
    lb.g1_p AS g1_phone,
    lb.g2_n AS g2_name,
    lb.g2_p AS g2_phone,
    lb.p_name AS partner_name
  FROM loan_base lb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. get_max_receipt_number RPC
CREATE OR REPLACE FUNCTION finance.get_max_receipt_number()
RETURNS integer AS $$
DECLARE
  max_num integer := 0;
  temp_num integer;
BEGIN
  -- Scan cd_ledger_entries
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[rR][cC]([0-9]+)') AS INTEGER)), 0)
  INTO temp_num
  FROM finance.cd_ledger_entries
  WHERE receipt_no ~* '^RC[0-9]+';
  
  IF temp_num > max_num THEN
    max_num := temp_num;
  END IF;
  
  -- Scan cd_interest_details
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[rR][cC]([0-9]+)') AS INTEGER)), 0)
  INTO temp_num
  FROM finance.cd_interest_details
  WHERE receipt_no ~* '^RC[0-9]+';
  
  IF temp_num > max_num THEN
    max_num := temp_num;
  END IF;

  -- Scan loan_transactions
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[rR][cC]([0-9]+)') AS INTEGER)), 0)
  INTO temp_num
  FROM finance.loan_transactions
  WHERE receipt_no ~* '^RC[0-9]+';
  
  IF temp_num > max_num THEN
    max_num := temp_num;
  END IF;
  
  -- Scan documents_returned
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_no FROM '[rR][cC]([0-9]+)') AS INTEGER)), 0)
  INTO temp_num
  FROM finance.documents_returned
  WHERE receipt_no ~* '^RC[0-9]+';
  
  IF temp_num > max_num THEN
    max_num := temp_num;
  END IF;

  RETURN max_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. bulk_update_dues RPC
CREATE OR REPLACE FUNCTION finance.bulk_update_dues(dues_data jsonb)
RETURNS void AS $$
BEGIN
  UPDATE finance.due_entries d
  SET 
    paid_amount = (val->>'paid_amount')::numeric,
    status = (val->>'status')::text,
    updated_at = (val->>'updated_at')::timestamptz
  FROM jsonb_array_elements(dues_data) AS val
  WHERE d.id = (val->>'id')::uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
