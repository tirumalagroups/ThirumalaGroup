import React, { forwardRef } from 'react';

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLSelectElement>) => void;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      value,
      onChange,
      options,
      placeholder = 'Select an option...',
      required = false,
      disabled = false,
      className = '',
      onKeyDown,
    },
    ref
  ) => {
    const isFinance = typeof window !== 'undefined' && window.location.pathname.startsWith('/finance');
    const displayPlaceholder = isFinance ? placeholder.toUpperCase() : placeholder;

    return (
      <div className={className}>
        {label && (
          <label className={isFinance ? 'peek-label uppercase' : 'block text-sm font-medium text-gray-700 mb-1'}>
            {label}
            {required && <span className='text-red-500 ml-1'>*</span>}
          </label>
        )}
        <select
          ref={ref}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          required={required}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed ${isFinance ? 'peek-button uppercase' : ''}`}
          style={{ opacity: disabled ? 0.7 : 1 }}
        >
          <option value=''>{displayPlaceholder}</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {isFinance ? option.label.toUpperCase() : option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;