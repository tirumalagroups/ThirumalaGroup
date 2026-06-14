-- Extend finance_partners table for new redesign fields
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS partner_id SERIAL;
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS is_md BOOLEAN DEFAULT false;
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS home_phone TEXT;
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS village TEXT;
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS md_name TEXT;
ALTER TABLE finance_partners ADD COLUMN IF NOT EXISTS address TEXT;
