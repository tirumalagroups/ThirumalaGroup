import React, { useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { Search, User, Phone, MapPin, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

interface CustomerAadhaarDetails {
  customer: any;
  loans: any[];
  npaRecords: any[];
}

const AadhaarSearch: React.FC = () => {
  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CustomerAadhaarDetails | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aadhaar.trim()) {
      toast.error('PLEASE ENTER AN AADHAAR CARD NUMBER OR PHONE NUMBER');
      return;
    }
    const cleanUid = aadhaar.trim();

    setLoading(true);
    setSearched(true);
    try {
      // 1. Fetch customer matching Aadhaar OR Phone (phone, phone_1, phone_2)
      const { data: customerData, error: custError } = await supabase
        .from('finance_customers')
        .select('*')
        .or(`aadhaar.eq.${cleanUid},phone.eq.${cleanUid},phone_1.eq.${cleanUid},phone_2.eq.${cleanUid}`)
        .limit(1);

      if (custError) throw custError;

      const customer = customerData && customerData.length > 0 ? customerData[0] : null;

      if (!customer) {
        setResult(null);
        toast.error('NO CUSTOMER FOUND MATCHING THIS AADHAAR OR PHONE NUMBER');
        return;
      }

      // 2. Fetch all loans for this customer
      const { data: loans, error: loansError } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('customer_id', customer.id)
        .order('date', { ascending: false });

      if (loansError) throw loansError;

      // Fetch all dues for these loans
      const loanIds = (loans || []).map(l => l.id);
      let duesList: any[] = [];
      if (loanIds.length > 0) {
        const { data: duesData, error: duesError } = await supabase
          .from('finance_dues')
          .select('*')
          .in('loan_id', loanIds)
          .order('due_date', { ascending: true });
        if (!duesError && duesData) {
          duesList = duesData;
        }
      }

      // 3. Fetch transactions to calculate collection ratios for each loan
      const txs = await supabaseFinance.getTransactions();
      const enrichedLoans = (loans || []).map(l => {
        const principal = Number(l.amount);
        const rate = Number(l.interest_rate);
        const duration = Number(l.duration_months);
        const repayable = principal + (principal * (rate / 100) * duration);

        const lCols = txs.filter(t => t.loan_id === l.id && t.type === 'Collection');
        const collected = lCols.reduce((sum, c) => sum + Number(c.amount), 0);
        
        const payRatio = repayable > 0 ? Math.min(100, Math.round((collected / repayable) * 100)) : 0;
        const outstanding = Math.max(0, repayable - collected);
        const loanDues = duesList.filter(d => d.loan_id === l.id);

        return {
          ...l,
          totalRepayable: repayable,
          totalCollected: collected,
          outstanding,
          payRatio,
          dues: loanDues
        };
      });

      const { data: npaRecords, error: npaError } = await supabase
        .from('finance_npa_records')
        .select('*')
        .or(`customer_id.eq.${customer.id},aadhaar.eq.${customer.aadhaar || 'NONE'},phone.eq.${customer.phone || 'NONE'}`);

      if (npaError) throw npaError;

      setResult({
        customer,
        loans: enrichedLoans,
        npaRecords: npaRecords || []
      });

      toast.success('RECORD FOUND');
    } catch (err) {
      console.error(err);
      toast.error('ERROR QUERYING DATABASE');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="finance-h1">AADHAAR SEARCH ENGINE</h1>
          <p className="finance-small-label uppercase">LOOK UP CUSTOMER RISK PROFILE AND FULL HISTORICAL LOAN SHEETS USING AADHAAR UID OR PHONE NUMBER</p>
        </div>
      </div>

      {/* Search Bar */}
      <Card title="QUERY AADHAAR OR PHONE RECORD" subtitle="LOOKUP THE CREDIT REGISTRY DATABASE" className="max-w-md">
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            label="AADHAAR CARD NUMBER OR PRIMARY PHONE NUMBER *"
            value={aadhaar}
            onChange={setAadhaar}
            placeholder="E.G. 12-DIGIT UID OR 10-DIGIT PHONE"
            required
          />
          <Button type="submit" variant="success" className="w-full" icon={Search} disabled={loading}>
            {loading ? 'SEARCHING...' : 'SEARCH REGISTRY'}
          </Button>
        </form>
      </Card>

      {/* Results view */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : result ? (
        <div className="space-y-6">
          {/* NPA Alert Banner */}
          {result.npaRecords && result.npaRecords.length > 0 && (
            <div className="bg-red-50 border-2 border-red-500 text-red-900 p-6 rounded-lg space-y-3 shadow-md animate-pulse">
              <h3 className="font-bold text-base tracking-wider uppercase text-red-950 flex items-center gap-2">
                ⚠️ NPA RECORD DETECTED - WARNING - HIGH RISK PROFILE
              </h3>
              {result.npaRecords.map((rec: any, index: number) => {
                const totalLiability = rec.total_liability !== undefined && rec.total_liability !== null && Number(rec.total_liability) > 0
                  ? Number(rec.total_liability) 
                  : (Number(rec.balance_amount || 0) + Number(rec.interest_due || 0) + Number(rec.penalty_due || 0));
                
                const waivedAmount = rec.waived_amount !== undefined && rec.waived_amount !== null && Number(rec.waived_amount) > 0
                  ? Number(rec.waived_amount)
                  : Math.max(0, totalLiability - Number(rec.settlement_amount || 0));

                return (
                  <div key={rec.id || index} className="text-sm font-semibold grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-red-200 pt-3">
                    <div>LOAN ID: {rec.loan_id || 'N/A'}</div>
                    <div className="text-red-750">TOTAL LIABILITY: ₹{totalLiability.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="text-red-750">SETTLEMENT AMOUNT: ₹{(rec.settlement_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="text-red-750">WAIVED AMOUNT: ₹{waivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer profile */}
            <Card title="CUSTOMER REGISTRY CARD" subtitle="IDENTITY DETAILS SAVED IN CREDIT REGISTRY">
              <div className="space-y-4 text-gray-700 finance-input">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-gray-900 finance-card-title">{result.customer.name}</h4>
                    <p className="text-gray-400 finance-caption">CREATED: {new Date(result.customer.created_at).toLocaleDateString('en-IN')}</p>
                  </div>
                </div>
                <div className="space-y-2 border-t pt-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="finance-input">{result.customer.phone || result.customer.phone_1 || 'NO PHONE RECORDED'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <span className="finance-input">{result.customer.address || 'NO ADDRESS RECORDED'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <span className="font-mono text-gray-900 finance-input">AADHAAR: {result.customer.aadhaar}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Customer loan list */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-gray-900 finance-brand font-bold uppercase">HISTORICAL CREDIT LEDGERS</h3>
              {result.loans.length === 0 ? (
                <div className="p-8 text-center text-gray-400 border rounded-lg bg-gray-50/50">
                  NO CREDIT LOAN ACCOUNTS FOUND ASSOCIATED WITH THIS PROFILE.
                </div>
              ) : (
                result.loans.map((loan) => (
                  <Card
                    key={loan.id}
                    title={
                      <div className="flex justify-between items-center w-full">
                        <span className="font-mono text-gray-900 finance-input">{loan.loan_id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full ${ loan.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800' } finance-header-time`}>
                          {loan.status ? loan.status.toUpperCase() : ''}
                        </span>
                      </div>
                    }
                    subtitle={`DISBURSED DATE: ${new Date(loan.date).toLocaleDateString('en-IN')}`}
                    className="shadow-sm hover:border-green-200 transition-all border border-gray-100"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-gray-600 mb-4 finance-caption">
                      <div>
                        <span className="block text-gray-400 finance-small-label uppercase">PRINCIPAL</span>
                        <span className="text-gray-900 finance-input">₹{Number(loan.amount).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400 finance-small-label uppercase">TOTAL REPAYABLE</span>
                        <span className="text-gray-900 finance-input">₹{loan.totalRepayable.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400 finance-small-label uppercase">PAID COLLECTED</span>
                        <span className="text-green-600 finance-input">₹{loan.totalCollected.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="block text-gray-400 finance-small-label uppercase">REMAINING BAL</span>
                        <span className="text-orange-700 finance-input">₹{loan.outstanding.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Payment Ratio Progress Bar */}
                    <div>
                      <div className="flex justify-between text-gray-500 mb-1 finance-small-label">
                        <span>COLLECTION REPAYMENT PROGRESS</span>
                        <span>{loan.payRatio}% PAID</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden border">
                        <div
                          className="bg-green-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${loan.payRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Surety details preview */}
                    {(loan.surety_name || loan.remarks) && (
                      <div className="mt-4 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-400 finance-small-label">
                        {loan.surety_name && (
                          <p>GUARANTOR: <span className="text-gray-600 finance-input">{loan.surety_name}</span></p>
                        )}
                        {loan.remarks && (
                          <p>REMARKS: <span className="text-gray-500 italic finance-input">"{loan.remarks}"</span></p>
                        )}
                      </div>
                    )}

                    {/* Dues Schedule */}
                    {loan.dues && loan.dues.length > 0 && (
                      <div className="mt-4 pt-3 border-t">
                        <p className="text-gray-700 mb-2 finance-header-time font-bold uppercase">INSTALMENT DUES SCHEDULE</p>
                        <div className="max-h-32 overflow-y-auto border rounded divide-y">
                          {loan.dues.map((due: any) => (
                            <div key={due.id} className="flex justify-between p-2 finance-small-label">
                              <span>{new Date(due.due_date).toLocaleDateString('en-IN')}</span>
                              <span>DUE: ₹{Number(due.amount).toLocaleString('en-IN')}</span>
                              <span className={`px-2 py-0.5 rounded-full ${ due.status === 'Paid' ? 'bg-green-100 text-green-800' : due.status === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' } finance-input`}>
                                {due.status ? due.status.toUpperCase() : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      ) : searched ? (
        <div className="flex flex-col items-center justify-center border border-dashed rounded-lg py-16 bg-gray-50/20">
          <CreditCard className="w-10 h-10 text-gray-300 mb-2 stroke-1" />
          <p className="finance-small-label uppercase">REGISTRY SEARCH WAS NEGATIVE. CHECK AADHAAR/PHONE SPACING AND DIGIT COUNTS.</p>
        </div>
      ) : null}
    </div>
  );
};

export default AadhaarSearch;
