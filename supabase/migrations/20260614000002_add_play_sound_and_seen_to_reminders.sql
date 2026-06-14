-- Add play_sound and seen columns to regular.reminders and itr.reminders tables
ALTER TABLE regular.reminders ADD COLUMN IF NOT EXISTS play_sound BOOLEAN DEFAULT TRUE;
ALTER TABLE regular.reminders ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT FALSE;

ALTER TABLE itr.reminders ADD COLUMN IF NOT EXISTS play_sound BOOLEAN DEFAULT TRUE;
ALTER TABLE itr.reminders ADD COLUMN IF NOT EXISTS seen BOOLEAN DEFAULT FALSE;
