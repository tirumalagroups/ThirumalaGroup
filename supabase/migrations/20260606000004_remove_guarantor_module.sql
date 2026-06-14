-- Add address location fields to finance_customers
ALTER TABLE finance_customers
ADD COLUMN IF NOT EXISTS aadhaar_address text,
ADD COLUMN IF NOT EXISTS aadhaar_village text,
ADD COLUMN IF NOT EXISTS aadhaar_mandal text,
ADD COLUMN IF NOT EXISTS aadhaar_district text,
ADD COLUMN IF NOT EXISTS present_address text,
ADD COLUMN IF NOT EXISTS present_village text,
ADD COLUMN IF NOT EXISTS present_mandal text,
ADD COLUMN IF NOT EXISTS present_district text;

-- Drop foreign key constraints on finance_loans referencing finance_guarantors
ALTER TABLE finance_loans DROP CONSTRAINT IF EXISTS finance_loans_guarantor_1_id_fkey;
ALTER TABLE finance_loans DROP CONSTRAINT IF EXISTS finance_loans_guarantor_2_id_fkey;

-- Migrate existing guarantors to finance_customers
-- Update loans to use existing customers if Aadhaar matches
UPDATE finance_loans l
SET guarantor_1_id = c.id
FROM finance_guarantors g
JOIN finance_customers c ON g.aadhaar = c.aadhaar
WHERE l.guarantor_1_id = g.id
  AND g.aadhaar IS NOT NULL;

UPDATE finance_loans l
SET guarantor_2_id = c.id
FROM finance_guarantors g
JOIN finance_customers c ON g.aadhaar = c.aadhaar
WHERE l.guarantor_2_id = g.id
  AND g.aadhaar IS NOT NULL;

-- Copy remaining guarantors to finance_customers using NOT EXISTS to avoid NULL-subquery issues
INSERT INTO finance_customers (
  id, name, phone, address, aadhaar, customer_photo_url, 
  father_husband_name, father_name, 
  aadhaar_address, aadhaar_village, aadhaar_mandal, aadhaar_district,
  present_address, present_village, present_mandal, present_district,
  fingerprint_url, fingerprint_template, fingerprint_added
)
SELECT 
  g.id, g.name, g.phone, COALESCE(g.current_address, g.present_address, g.permanent_address, g.aadhaar_address) as address, g.aadhaar, g.photo_url as customer_photo_url, 
  g.father_name as father_husband_name, g.father_name, 
  COALESCE(g.permanent_address, g.aadhaar_address) as aadhaar_address, COALESCE(g.permanent_village, g.village) as aadhaar_village, COALESCE(g.permanent_mandal, g.mandal) as aadhaar_mandal, COALESCE(g.permanent_district, g.district) as aadhaar_district,
  COALESCE(g.current_address, g.present_address) as present_address, COALESCE(g.current_village, g.village) as present_village, COALESCE(g.current_mandal, g.mandal) as present_mandal, COALESCE(g.current_district, g.district) as present_district,
  g.fingerprint_image_url as fingerprint_url, g.fingerprint_template, COALESCE(g.fingerprint_added, false) as fingerprint_added
FROM finance_guarantors g
WHERE NOT EXISTS (
  SELECT 1 FROM finance_customers c WHERE c.id = g.id
)
AND (g.aadhaar IS NULL OR NOT EXISTS (
  SELECT 1 FROM finance_customers c WHERE c.aadhaar = g.aadhaar
))
ON CONFLICT (aadhaar) DO NOTHING;

-- Nullify any invalid guarantor references that do not exist in finance_customers to prevent constraint errors
UPDATE finance_loans l
SET guarantor_1_id = NULL
WHERE guarantor_1_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM finance_customers c WHERE c.id = l.guarantor_1_id
  );

UPDATE finance_loans l
SET guarantor_2_id = NULL
WHERE guarantor_2_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM finance_customers c WHERE c.id = l.guarantor_2_id
  );

-- Re-link loans to finance_customers(id)
ALTER TABLE finance_loans ADD CONSTRAINT finance_loans_guarantor_1_id_fkey FOREIGN KEY (guarantor_1_id) REFERENCES finance_customers(id) ON DELETE SET NULL;
ALTER TABLE finance_loans ADD CONSTRAINT finance_loans_guarantor_2_id_fkey FOREIGN KEY (guarantor_2_id) REFERENCES finance_customers(id) ON DELETE SET NULL;
