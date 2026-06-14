import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const FinanceHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleBackToModeSelection = () => {
    navigate('/mode-selection');
  };

  return (
    <header className="bg-[#0b1329] text-white px-6 py-3 flex items-center justify-between border-b border-slate-800 select-none">
      {/* Left side logo and title */}
      <div className="flex items-center gap-4">
        <button 
          onClick={handleBackToModeSelection}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
          title="Back to Mode Selection"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center tracking-[0.16px] shadow-inner text-white font-bold text-sm">
            TF
          </div>
          <div>
            <h1 className="tracking-[0.16px] text-white font-bold text-lg leading-none">
              TIRUMALA FINANCE
            </h1>
            <p className="text-slate-400 text-[10px] tracking-wider mt-1 font-semibold uppercase leading-none">
              FINANCE MANAGEMENT SYSTEM
            </p>
          </div>
        </div>
      </div>

      {/* Right side controls, quick actions and status */}
      <div className="flex items-center gap-6">

        {/* Date and dynamic clock */}
        <div className="text-right hidden sm:block">
          <p className="text-slate-400 tracking-[0.16px] finance-header-time">
            {format(time, 'dd MMM yyyy, HH:mm').toUpperCase()}
          </p>
        </div>

        {/* User profile & actions */}
        <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
          <div className="flex items-center gap-2 finance-caption">
            <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 border border-slate-600 finance-header-time uppercase">
              {user?.username.charAt(0)}
            </span>
          </div>
          <span className="hidden lg:inline text-slate-300 finance-input">
              {user?.username.toUpperCase()}
            </span>

          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default FinanceHeader;
