import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerActions?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  headerActions,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}
    >
      {(title || subtitle || headerActions) && (
        <div className='px-6 py-4 border-b border-gray-200 flex items-center justify-between'>
          <div>
            {title && (
              <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
            )}
            {subtitle && <p className='text-sm text-gray-500 mt-1'>{subtitle}</p>}
          </div>
          {headerActions && (
            <div className='flex items-center gap-2'>{headerActions}</div>
          )}
        </div>
      )}
      <div className='p-6'>{children}</div>
    </div>
  );
};

export default Card;
