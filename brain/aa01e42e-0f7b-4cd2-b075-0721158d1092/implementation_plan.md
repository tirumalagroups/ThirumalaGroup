# Finance Mode Update Plan (5 Jun 2026)

This plan covers the requested changes strictly for the Finance module, ensuring no impact on Regular or ITR modes. The build will remain stable and the styling will be preserved.

## Proposed Changes

### 1. Database Migrations
Create a safe migration script to add the required tables and columns using `IF NOT EXISTS`.

#### [NEW] `supabase/migrations/20260605000000_finance_june5_updates.sql`
- **Table `finance_npa_records`**: For storing NPA closures (`id`, `loan_id`, `customer_id`, `customer_name`, `aadhaar`, `phone`, `loan_type`, `loan_amount`, `paid_amount`, `balance_amount`, `interest_due`, `penalty_due`, `settlement_amount`, `reason`, `full_history_json`, `closed_by`, `closed_at`, `created_at`).
- **Table `finance_cd_ledger_entries`**: For CD Ledger payments, storing partial/renewal splits (`id`, `loan_id`, `date`, `receipt_no`, `total_paid`, `principal_part`, `interest_part`, `penalty_part`, `particulars`, `user_name`, `created_at`).
- **Table `finance_cd_interest_details`**: As requested, for specific CD interest details if required for the report logic.
- **Table `finance_documents_returned`**: For recording document returns upon closure.
- **Alter `finance_loans`**: Add columns `penalty_percent` (numeric, default 0.75), `document_charges` (numeric), `npa_closed` (boolean).

---

### 2. New Loan Changes
#### [MODIFY] `src/pages/finance/LoanEntry.tsx`
- **Address Helper Text**: Append `(Aadhaar Address)` to Village, Mandal, and District labels in the UI.
- **Loan Terms Section**:
  - Remove `Annual Hold` and `Partial Paid` fields.
  - Add `Penalty Percent` input (default `0.75`).
  - Set `Rate of Interest` default to `3`.
  - Fetch default rates from Ledger Settings if they exist.
  - Make sure `Period` uses Days implicitly and handles UI labels properly.
- **NPA Warning**: When Aadhaar is entered or customer is selected, check `finance_npa_records`. If found, show an inline warning side-panel about previous NPA history.

---

### 3. CD Ledger Main Flow & Logic
#### [MODIFY] `src/pages/finance/CDLedger.tsx`
- **Loan Number Generation**: Prefix with `CD-` and sequence automatically.
- **Auto-Fill from New Loan**:
  - Convert `A/C Number` to a dropdown/searchable select showing pending loans.
  - On select, auto-populate all customer details, loan amount, rates, guarantor details, photos, etc.
- **Due Date & Days Calculation**:
  - Calculate `Days Count` from loan creation date to today.
  - Update `Next Due Date` logic (Entry Date + 10 days).
- **Grace Period & Interest/Penalty Logic**:
  - Interest calculates from due date (default 3%).
  - Grace period is 5 days. Penalty (default 0.75%) applies from 6th day onwards.
- **Payment Deductions & Renewals**:
  - Allow input for `Total Amount Paying`.
  - On "Renewal Account": deduct in order: Penalty -> Interest -> Principal.
  - Mark as partial payment if `<` total amount for renewal. Store splits in `finance_cd_ledger_entries`.
- **Ledger Rows**: Render Interest ("CD COMMISSION A/C") and Penalty ("PENALTY CD A/C") rows based on transactions. Add `User` column.

---

### 4. Search Updates
#### [MODIFY] `src/pages/finance/CDLedger.tsx` (and global `Search.tsx` if needed)
- Expand the existing filter function to include `Village`, `Mandal`, `District`, `Guarantor`, `Partner`, and `Receipt Number` when performing local and DB searches.

---

### 5. Document Returns & NPA Close
#### [MODIFY] `src/pages/finance/CDLedger.tsx`
- **NPA Close Button**: Prompt for settlement reason/amount, close the active loan, and write history to `finance_npa_records`. Remove from active list.
- **Documents Returned**: Action to log into `finance_documents_returned` when closing an account.

---

### 6. Reports & Printing
#### [MODIFY] `src/components/finance/FinancePrintPreview.tsx` or create a new specific component
- **Interest Details Report**: Implement the custom preview modal matching the provided screenshot style. Include customer details, receipt numbers, "Renewed till" text, split rows, and guarantor footers.

## User Review Required

> [!WARNING]
> This plan involves adding database migrations. Are you comfortable with me applying the `.sql` migration file directly via `supabase db push` or through the SQL editor, or do you handle migrations manually?

## Verification Plan

1. **New Loan Validation**: Verify `Annual Hold` is gone, `Penalty Percent` appears, and defaults are 3% and 0.75%. Test NPA Aadhaar warning.
2. **CD Ledger**: Select a loan, verify autofill works perfectly. Enter a payment amount, verify split logic correctly deducts penalty then interest.
3. **Database**: Check that partial payments don't incorrectly change the loan status to fully renewed unless conditions are met.
4. **Print Layout**: Check the Interest Details print layout matches the legacy software style.
