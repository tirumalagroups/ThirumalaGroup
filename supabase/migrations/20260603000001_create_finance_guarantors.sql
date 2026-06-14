CREATE TABLE IF NOT EXISTS finance_guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guarantor_id SERIAL,
  name text NOT NULL,
  aadhaar text UNIQUE,
  phone text,
  address text,
  photo_url text,
  fingerprint_template text,
  fingerprint_image_url text,
  fingerprint_added boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE finance_guarantors ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "Allow authenticated full access to finance_guarantors" 
  ON finance_guarantors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add references in finance_loans for Guarantor 1 and Guarantor 2
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS guarantor_1_id uuid REFERENCES finance_guarantors(id) ON DELETE SET NULL;
ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS guarantor_2_id uuid REFERENCES finance_guarantors(id) ON DELETE SET NULL;
