import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabase } from '../../lib/supabase';
import { Printer, User, Phone, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import FinancePrintPreview from '../../components/finance/FinancePrintPreview';

interface NewCustItem {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  aadhaar: string | null;
  createdAt: string;
  loanId: string | null;
  amount: number | null;
}

const NewCustomers: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<NewCustItem[]>([]);
  const [filteredCusts, setFilteredCusts] = useState<NewCustItem[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // 1 month ago
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchNewCustomers();
  }, [startDate, endDate]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredCusts(customers);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.aadhaar && c.aadhaar.includes(q)) ||
      (c.loanId && c.loanId.toLowerCase().includes(q))
    );
    setFilteredCusts(filtered);
  }, [searchQuery, customers]);

  const fetchNewCustomers = async () => {
    setLoading(true);
    try {
      // Query customers joining within date range
      // Joining with loans to check details
      const { data, error } = await supabase
        .from('finance_customers')
        .select(`
          id,
          name,
          phone,
          address,
          aadhaar,
          created_at,
          loans:finance_loans(
            loan_id,
            amount
          )
        `)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .lte('created_at', `${endDate}T23:59:59Z`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: NewCustItem[] = (data || []).map((c: any) => {
        // Get the latest loan if multiple exist
        const latestLoan = c.loans && c.loans.length > 0 ? c.loans[0] : null;
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          aadhaar: c.aadhaar,
          createdAt: c.created_at,
          loanId: latestLoan ? latestLoan.loan_id : null,
          amount: latestLoan ? Number(latestLoan.amount) : null
        };
      });

      setCustomers(formatted);
      setFilteredCusts(formatted);

    } catch (err) {
      console.error(err);
      toast.error('Failed to query new registrations');
    } finally {
      setLoading(false);
    }
  };

  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
        <thead>
          <tr className="bg-gray-100">
            <th className="finance-small-label uppercase">Registration Date</th>
            <th className="finance-small-label uppercase">Customer Profile</th>
            <th className="finance-small-label uppercase">Address</th>
            <th className="finance-small-label uppercase">Aadhaar UID</th>
            <th className="finance-small-label uppercase">Active Loan ID</th>
            <th className="text-right finance-small-label uppercase">Loan Amount</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredCusts.map((cust) => (
            <tr key={cust.id} className="hover:bg-gray-50/50">
              <td className="px-3 py-3 whitespace-nowrap text-gray-600">
                {new Date(cust.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-50 text-green-700 rounded-full print:hidden">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-gray-900 finance-input">{cust.name}</div>
                    {cust.phone && (
                      <div className="text-gray-400 flex items-center gap-1 mt-0.5 finance-small-label">
                        <Phone className="w-2.5 h-2.5 print:hidden" /> {cust.phone}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 text-gray-500 max-w-xs truncate print:whitespace-normal">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400 shrink-0 print:hidden" />
                  <span>{cust.address || '-'}</span>
                </div>
              </td>
              <td className="px-3 py-3 font-mono text-gray-600">
                {cust.aadhaar || '-'}
              </td>
              <td className="px-3 py-3 font-mono text-gray-900 finance-input">
                {cust.loanId || '-'}
              </td>
              <td className="px-3 py-3 text-right text-green-700 finance-input">
                {cust.amount ? `₹${cust.amount.toLocaleString('en-IN')}` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto print:p-0">
      {/* Header */}
      <div className={`flex justify-between items-center border-b border-green-100 pb-4 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <div>
          <h1 className="finance-h1">New Customer Registrations</h1>
          <p className="finance-small-label uppercase">Audit log of customers added within specific calendar ranges</p>
        </div>
        <Button onClick={() => setShowPrintPreview(true)} variant="primary" size="sm" icon={Printer}>
          Print Registrations
        </Button>
      </div>

      {/* Date Filters */}
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 ${showPrintPreview ? 'print:hidden' : ''}`}>
        <Input label="Registered From" type="date" value={startDate} onChange={setStartDate} />
        <Input label="Registered To" type="date" value={endDate} onChange={setEndDate} />
        <Input label="Quick Filter Results" value={searchQuery} onChange={setSearchQuery} placeholder="Search by name, phone..." />
      </div>

      {/* Main UI Card */}
      <Card title="Customer Entry Directory" subtitle={`${filteredCusts.length} new records created`} className={`shadow-md ${showPrintPreview ? 'print:hidden' : ''}`}>
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-green-500"></div>
          </div>
        ) : filteredCusts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No new customers found in this date range</div>
        ) : (
          renderTable()
        )}
      </Card>

      {/* Print Preview Modal */}
      <FinancePrintPreview
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title="New Customer Registrations"
        documentTitle="NEW CUSTOMERS REGISTRATION REPORT"
      >
        <div className="space-y-6 mt-6">
          <Card title="Customer Entry Directory" subtitle={`${filteredCusts.length} new records created`} className="shadow-none border-0">
            {filteredCusts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No new customers found in this date range</div>
            ) : (
              renderTable()
            )}
          </Card>
        </div>
      </FinancePrintPreview>
    </div>
  );
};

export default NewCustomers;
