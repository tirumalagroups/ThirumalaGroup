-- Create reminders table
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time without time zone,
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'low',
  reminder_type text NOT NULL CHECK (reminder_type IN ('one_time', 'recurring')) DEFAULT 'one_time',
  recurring_interval text CHECK (recurring_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  notify_before_days integer NOT NULL DEFAULT 0,
  assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  mode text NOT NULL CHECK (mode IN ('regular', 'itr')),
  category text NOT NULL DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'VEHICLE', 'LOAN', 'STAFF', 'DOCUMENT', 'TAX', 'MEETING', 'FOLLOWUP')),
  completion_notes text,
  completed_at timestamptz,
  snoozed_until date,
  is_system_generated boolean DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Disable RLS to match the pattern of all other tables in the project (uses client-side bcrypt/session auth)
ALTER TABLE reminders DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminders_mode ON reminders(mode);
CREATE INDEX IF NOT EXISTS idx_reminders_event_date ON reminders(event_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_assigned_user_id ON reminders(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_snoozed_until ON reminders(snoozed_until);

-- Seed feature
INSERT INTO features (key, name) 
VALUES ('reminders', 'Reminders & Events') 
ON CONFLICT (key) DO NOTHING;
