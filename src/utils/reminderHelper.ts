import { startOfDay, addDays, addWeeks, addMonths, addYears, differenceInDays } from 'date-fns';
import { supabaseDB, Reminder } from '../lib/supabaseDatabase';

export interface CreateReminderParams {
  title: string;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  reminder_type: 'one_time' | 'recurring';
  recurring_interval?: 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
  notify_before_days?: number;
  assigned_user_id?: string | null;
  mode: 'regular' | 'itr';
  category?: 'GENERAL' | 'VEHICLE' | 'LOAN' | 'STAFF' | 'DOCUMENT' | 'TAX' | 'MEETING' | 'FOLLOWUP';
  is_system_generated?: boolean;
  book_id?: string | null;
  play_sound?: boolean;
}

/**
 * Helper to parse YYYY-MM-DD string into a local Date object at midnight to avoid timezone shifts.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Helper to format a local Date object into YYYY-MM-DD format.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if a reminder should be shown as a notification on the dashboard
 */
export function canShowReminderNotification(reminder: Partial<Reminder>, today: Date = new Date()): boolean {
  if (reminder.status !== 'pending' || reminder.deleted_at || reminder.seen) {
    return false;
  }

  const todayStart = startOfDay(today);
  if (!reminder.event_date) return false;
  
  const eventDate = parseLocalDate(reminder.event_date);

  // If snoozed, check if snooze has elapsed
  if (reminder.snoozed_until) {
    const snoozeDate = parseLocalDate(reminder.snoozed_until);
    if (snoozeDate > todayStart) {
      return false; // Hidden due to active snooze
    }
  }

  // Calculate the maximum date starting from today to show notification
  const maxDisplayDate = addDays(todayStart, reminder.notify_before_days || 0);

  // Return true if event date is on or before maxDisplayDate
  return eventDate <= maxDisplayDate;
}

export type ReminderColorStatus = 'red' | 'orange' | 'yellow' | 'blue' | 'dark-red' | 'green';

/**
 * Gets the color status of a reminder based on its date and status
 */
export function getReminderColorStatus(reminder: Partial<Reminder>, today: Date = new Date()): ReminderColorStatus {
  if (reminder.status === 'completed') {
    return 'green';
  }

  const todayStart = startOfDay(today);
  if (!reminder.event_date) return 'blue';
  
  const eventDate = parseLocalDate(reminder.event_date);
  const diff = differenceInDays(eventDate, todayStart);

  if (diff < 0) {
    return 'dark-red'; // Overdue
  } else if (diff === 0) {
    return 'red'; // Today
  } else if (diff === 1) {
    return 'orange'; // Tomorrow
  } else if (diff <= 7) {
    return 'yellow'; // Within 7 Days
  } else {
    return 'blue'; // Future
  }
}

/**
 * Automatically calculates the next occurrence date for a recurring reminder
 */
export function calculateNextOccurrence(currentDateStr: string, interval: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
  const currentDate = parseLocalDate(currentDateStr);
  let nextDate: Date;

  switch (interval) {
    case 'daily':
      nextDate = addDays(currentDate, 1);
      break;
    case 'weekly':
      nextDate = addWeeks(currentDate, 1);
      break;
    case 'monthly':
      nextDate = addMonths(currentDate, 1);
      break;
    case 'yearly':
      nextDate = addYears(currentDate, 1);
      break;
    default:
      nextDate = addDays(currentDate, 1);
  }

  return formatLocalDate(nextDate);
}

/**
 * Reusable system helper for future transaction/module integrations
 */
export async function createSystemReminder(params: CreateReminderParams, createdByUserId: string): Promise<Reminder | null> {
  const reminderData = {
    title: params.title,
    description: params.description || null,
    event_date: params.event_date,
    event_time: params.event_time || null,
    priority: params.priority,
    reminder_type: params.reminder_type,
    recurring_interval: params.recurring_interval || null,
    notify_before_days: params.notify_before_days ?? 0,
    assigned_user_id: params.assigned_user_id || null,
    status: 'pending' as const,
    mode: params.mode,
    category: params.category || 'GENERAL',
    is_system_generated: params.is_system_generated ?? true,
    created_by: createdByUserId,
    completion_notes: null,
    completed_at: null,
    snoozed_until: null,
    deleted_at: null,
    book_id: params.book_id || null,
    play_sound: params.play_sound ?? true,
    seen: false
  };

  return await supabaseDB.createReminder(reminderData);
}
