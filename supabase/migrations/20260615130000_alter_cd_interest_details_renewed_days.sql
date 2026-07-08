-- Migration to alter cd_interest_details.renewed_days to numeric to support fractional/decimal days
ALTER TABLE finance.cd_interest_details 
ALTER COLUMN renewed_days TYPE numeric;
