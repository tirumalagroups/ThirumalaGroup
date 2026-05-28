import { useEffect, useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  startOfWeek,
  addDays,
  subMonths,
  addMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTableMode } from '../../contexts/TableModeContext';
import { supabaseDB } from '../../lib/supabaseDatabase';

interface CustomCalendarProps {
  onDateSelect: (date: string) => void;
  selectedDate?: string;
  onClose?: () => void;
  entries?: any[];
  dotColor?: 'green' | 'red' | 'dark-red';
}

const CustomCalendar = ({
  onDateSelect,
  selectedDate = '',
  onClose,
  entries: providedEntries,
  dotColor = 'red',
}: CustomCalendarProps) => {
  const { mode: tableMode } = useTableMode();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loadedEntries, setLoadedEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const entries = providedEntries ?? loadedEntries;

  useEffect(() => {
    if (providedEntries !== undefined && providedEntries !== null) return;

    let isMounted = true;

    const loadAll = async () => {
      setLoading(true);
      try {
        const all = await supabaseDB.getAllCashBookEntries();
        if (isMounted) setLoadedEntries(all || []);
      } catch (e) {
        console.error('Error loading entries for calendar:', e);
        if (isMounted) setLoadedEntries([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAll();

    return () => {
      isMounted = false;
    };
  }, [providedEntries, tableMode]);

  const datesWithEntries = useMemo(() => {
    const set = new Set<string>();
    if (!entries || entries.length === 0) return set;

    entries.forEach((entry: any) => {
      if (!entry || !entry.c_date) return;
      
      let dateStr = '';
      
      // Handle string dates - extract YYYY-MM-DD format
      if (typeof entry.c_date === 'string') {
        // Try to extract YYYY-MM-DD from string first (most common format)
        const dateMatch = entry.c_date.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          dateStr = dateMatch[1];
        } else {
          // Try parsing as Date object
          const d = new Date(entry.c_date);
          if (!isNaN(d.getTime())) {
            dateStr = format(d, 'yyyy-MM-dd');
          }
        }
      } else if (entry.c_date instanceof Date) {
        dateStr = format(entry.c_date, 'yyyy-MM-dd');
      }
      
      if (dateStr) {
        set.add(dateStr);
      }
    });

    return set;
  }, [entries]);

  const today = new Date();
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

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) =>
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1),
    );
  };

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    onDateSelect(dateStr);
    if (onClose) onClose();
  };

  const dotClass =
    dotColor === 'green'
      ? 'bg-green-500'
      : dotColor === 'dark-red'
      ? 'bg-red-800'
      : 'bg-red-500';

  return (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-4 min-w-[280px]">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => navigateMonth('prev')}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-sm">
          {monthNames[month]} {year}
        </h3>
        <button
          onClick={() => navigateMonth('next')}
          className="p-1 hover:bg-gray-100 rounded"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center font-medium text-gray-500">
            {day}
          </div>
        ))}

        {days.map((date, index) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const isCurrentMonth = date.getMonth() === month;
          const isToday = dateStr === format(today, 'yyyy-MM-dd');
          const isSelected = dateStr === selectedDate;
          const hasEntries = datesWithEntries.has(dateStr);

          let bgClass = '';
          if (isSelected) {
            bgClass = 'bg-blue-500 text-white';
          } else if (hasEntries && isCurrentMonth) {
            bgClass = 'bg-blue-100 text-gray-700';
          } else if (isToday) {
            bgClass = 'bg-blue-200 font-bold';
          }

          return (
            <button
              key={`${dateStr}-${index}`}
              onClick={() => handleDateClick(date)}
              type="button"
              className={`
                relative p-2 text-xs rounded transition-colors
                ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                ${bgClass}
                ${!bgClass ? 'hover:bg-blue-50' : ''}
              `}
            >
              <span className="relative z-0">{date.getDate()}</span>

              {hasEntries && (
                <div
                  className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${dotClass}`}
                  style={{
                    opacity: 1,
                    pointerEvents: 'none',
                    boxShadow: '0 0 2px rgba(0,0,0,0.6)',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span>Has entries</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            type="button"
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
          >
            Close
          </button>
        )}
      </div>

      {loading && (
        <div className="mt-2 text-xs text-gray-400 text-right">
          Loading entry indicators...
        </div>
      )}
    </div>
  );
};

export default CustomCalendar;

