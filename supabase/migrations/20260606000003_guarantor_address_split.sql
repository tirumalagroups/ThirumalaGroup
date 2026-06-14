ALTER TABLE finance_guarantors
ADD COLUMN IF NOT EXISTS permanent_address text,
ADD COLUMN IF NOT EXISTS permanent_village text,
ADD COLUMN IF NOT EXISTS permanent_mandal text,
ADD COLUMN IF NOT EXISTS permanent_district text,
ADD COLUMN IF NOT EXISTS current_address text,
ADD COLUMN IF NOT EXISTS current_village text,
ADD COLUMN IF NOT EXISTS current_mandal text,
ADD COLUMN IF NOT EXISTS current_district text;
