import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import FinanceSidebar from './FinanceSidebar';
import FinanceHeader from './FinanceHeader';
import { useTableMode } from '../../contexts/TableModeContext';

const Layout: React.FC = () => {
  const { isFinanceMode } = useTableMode();

  if (isFinanceMode) {
    return (
      <div className='flex flex-col h-screen overflow-hidden bg-slate-50 font-sans'>
        <FinanceHeader />
        <div className='flex flex-1 overflow-hidden'>
          <FinanceSidebar />
          <main className='flex-1 overflow-y-auto p-6'>
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-screen bg-gray-50'>
      <Sidebar />
      <div className='flex-1 flex flex-col overflow-hidden min-h-screen'>
        <Header />
        <main className='flex-1 overflow-y-auto p-6'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
