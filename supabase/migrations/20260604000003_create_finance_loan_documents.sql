CREATE TABLE IF NOT EXISTS finance_loan_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID REFERENCES finance_loans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  document_name TEXT NOT NULL,
  remarks TEXT,
  file_url TEXT,
  is_submitted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE finance_loan_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON finance_loan_documents
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON finance_loan_documents
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON finance_loan_documents
  FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON finance_loan_documents
  FOR DELETE USING (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX idx_finance_loan_documents_loan_id ON finance_loan_documents(loan_id);
