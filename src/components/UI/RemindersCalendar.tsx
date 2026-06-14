import React, { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  subMonths,
  addMonths,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Reminder } from '../../lib/supabaseDatabase';

interface RemindersCalendarProps {
  reminders: Reminder[];
  onDateSelect: (date: string) => void;
  selectedDate?: string;
  isMini?: boolean;
}

const RemindersCalendar: React.FC<RemindersCalendarProps> = ({
  reminders,
  onDateSelect,
  selectedDate = '',
  isMini = false,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
    return new Date();
  });

  const today = startOfDay(new Date());
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDay = startOfMonth(currentMonth);
  const startDate = startOfWeek(firstDay);

  const days: Date[] = [];
  let cursor = new Date(startDate);
  while (days.length < 42) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) =>
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  // Group reminders by date string YYYY-MM-DD
  const remindersByDate = useMemo(() => {
    const map: Record<string, Reminder[]> = {};
    reminders.forEach((r) => {
      if (!r.event_date) return;
      
      let dateStr = '';
      if (typeof r.event_date === 'string') {
        const dateMatch = r.event_date.match(/^(\d{4}-\d{2}-\d{2})/);
        dateStr = dateMatch ? dateMatch[1] : format(new Date(r.event_date), 'yyyy-MM-dd');
      } else {
        dateStr = format(new Date(r.event_date), 'yyyy-MM-dd');
      }

      if (!map[dateStr]) {
        map[dateStr] = [];
      }
      map[dateStr].push(r);
    });

    // Sort reminders in each date by priority: critical > high > medium > low
    const priorityWeights = { critical: 4, high: 3, medium: 2, low: 1 };
    Object.keys(map).forEach((dateStr) => {
      map[dateStr].sort((a, b) => {
        const wA = priorityWeights[a.priority] || 0;
        const wB = priorityWeights[b.priority] || 0;
        return wB - wA; // Highest priority first
      });
    });

    return map;
  }, [reminders]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getPriorityColorClass = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-blue-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getPriorityLabel = (priority: string) => {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl shadow-sm p-4 w-full ${isMini ? 'max-w-sm' : ''}`}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          type="button"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <h3 className="font-bold text-gray-800 text-sm md:text-base">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
          type="button"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-gray-500 text-xs mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-2">
            {isMini ? day.charAt(0) : day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dateStr === format(today, 'yyyy-MM-dd');
          const isSelected = dateStr === selectedDate;
          const dateReminders = remindersByDate[dateStr] || [];
          const hasReminders = dateReminders.length > 0;

          let bgClass = 'bg-white';
          let borderClass = 'border border-gray-100';
          let textClass = 'text-gray-700';

          if (isSelected) {
            bgClass = 'bg-blue-600';
            textClass = 'text-white font-bold';
            borderClass = 'border border-blue-600';
          } else if (isToday) {
            bgClass = 'bg-blue-50';
            textClass = 'text-blue-700 font-bold';
            borderClass = 'border border-blue-200';
          } else if (!isCurrentMonth) {
            textClass = 'text-gray-300';
            bgClass = 'bg-gray-25';
          }

          // Build tooltip text
          const tooltipLines = [format(date, 'dd-MM-yyyy')];
          if (hasReminders) {
            tooltipLines.push(`Reminders (${dateReminders.length}):`);
            dateReminders.forEach((r) => {
              tooltipLines.push(`- [${getPriorityLabel(r.priority)}] ${r.title}`);
            });
          }
          const tooltip = tooltipLines.join('\n');

          return (
            <button
              key={`${dateStr}-${idx}`}
              onClick={() => onDateSelect(dateStr)}
              type="button"
              title={tooltip}
              className={`
                relative flex flex-col items-center justify-between p-2 rounded-xl text-xs transition-all h-12 md:h-14
                ${bgClass} ${borderClass} ${textClass}
                ${!isSelected ? 'hover:bg-blue-25 hover:border-blue-100' : ''}
              `}
            >
              {/* Day Number */}
              <span className="text-xs font-semibold">{date.getDate()}</span>

              {/* Priority Dot Indicators (Up to 3 dots) */}
              {hasReminders && (
                <div className="flex gap-0.5 justify-center mt-1 w-full max-w-full overflow-hidden">
                  {dateReminders.slice(0, 3).map((r, rIdx) => (
                    <div
                      key={r.id || rIdx}
                      className={`w-1.5 h-1.5 rounded-full ${getPriorityColorClass(r.priority)}`}
                      style={{ boxShadow: '0 0 1px rgba(0,0,0,0.3)' }}
                    />
                  ))}
                  {dateReminders.length > 3 && (
                    <span className="text-[7px] leading-none text-gray-500 font-bold -mt-0.5">+</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {!isMini && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[10px] md:text-xs text-gray-500 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Low</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemindersCalendar;
