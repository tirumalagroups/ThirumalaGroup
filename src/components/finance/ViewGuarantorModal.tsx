import React, { useEffect, useState } from 'react';
import { X, User, Phone, MapPin, FileText, Activity } from 'lucide-react';
import { FinanceGuarantor } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';

interface ViewGuarantorModalProps {
  guarantor: FinanceGuarantor;
  onClose: () => void;
}

const ViewGuarantorModal: React.FC<ViewGuarantorModalProps> = ({ guarantor, onClose }) => {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLinkedLoans = async () => {
      try {
        const { data } = await supabase
          .from('finance_loans')
          .select('id, loan_id, customer_id, amount, status, date, finance_customers (name)')
          .or(`guarantor_1_id.eq.${guarantor.id},guarantor_2_id.eq.${guarantor.id}`);
        
        if (data) {
          setLoans(data);
        }
      } catch (err) {
        console.error('Failed to fetch linked loans', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchLinkedLoans();
  }, [guarantor.id]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-slate-900 finance-h2">GUARANTOR PROFILE</h2>
            <p className="text-slate-500 finance-small-label uppercase mt-0.5">
              ID: #{guarantor.guarantor_id || '—'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Left Column: Photo & Base Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-sm text-center">
                <div className="w-32 h-32 mx-auto rounded-xl border-2 border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center shadow-inner mb-4">
                  {guarantor.photo_url ? (
                    <img src={guarantor.photo_url} alt={guarantor.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-slate-300" />
                  )}
                </div>
                <h3 className="finance-header-time text-slate-900 uppercase">{guarantor.name}</h3>
                <p className="finance-caption text-slate-500 mt-1 uppercase">{guarantor.father_name ? `S/O ${guarantor.father_name}` : '—'}</p>
                
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-slate-600 finance-small-label border border-slate-200">
                  <Activity className="w-3.5 h-3.5" />
                  {guarantor.fingerprint_added ? 'FINGERPRINT CAPTURED' : 'FINGERPRINT PENDING'}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-sm space-y-4">
                <h4 className="finance-small-label text-slate-900 uppercase border-b border-slate-100 pb-2">CONTACT INFORMATION</h4>
                
                <div className="flex gap-3">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="space-y-1">
                    <p className="finance-input text-slate-800">{guarantor.phone || '—'}</p>
                    {guarantor.phone_2 && <p className="finance-caption text-slate-500">{guarantor.phone_2}</p>}
                  </div>
                </div>

                <div className="flex gap-3">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="finance-caption text-slate-500 uppercase">Aadhaar Number</p>
                    <p className="finance-input text-slate-800 font-mono tracking-wider mt-0.5">
                      {guarantor.aadhaar ? guarantor.aadhaar.replace(/(\d{4})/g, '$1 ').trim() : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Address & Loans */}
            <div className="md:col-span-2 space-y-6">
              
              <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-sm space-y-4">
                <h4 className="finance-small-label text-slate-900 uppercase border-b border-slate-100 pb-2">ADDRESS DETAILS</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-500 finance-caption uppercase">
                      <MapPin className="w-3.5 h-3.5" /> Permanent Address
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[80px]">
                      <p className="finance-input text-slate-800 mb-2">
                        {guarantor.permanent_address || guarantor.aadhaar_address || '—'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Village</p>
                          <p className="finance-input text-slate-700">{guarantor.permanent_village || guarantor.village || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Mandal</p>
                          <p className="finance-input text-slate-700">{guarantor.permanent_mandal || guarantor.mandal || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">District</p>
                          <p className="finance-input text-slate-700">{guarantor.permanent_district || guarantor.district || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-slate-500 finance-caption uppercase">
                      <MapPin className="w-3.5 h-3.5" /> Current Address
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 min-h-[80px]">
                      <p className="finance-input text-slate-800 mb-2">
                        {guarantor.current_address || guarantor.present_address || '—'}
                      </p>
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60">
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Village</p>
                          <p className="finance-input text-slate-700">{guarantor.current_village || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">Mandal</p>
                          <p className="finance-input text-slate-700">{guarantor.current_mandal || '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 uppercase">District</p>
                          <p className="finance-input text-slate-700">{guarantor.current_district || '—'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {guarantor.notes && (
                <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-sm">
                  <h4 className="finance-small-label text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3">NOTES / REMARKS</h4>
                  <p className="finance-input text-slate-700 whitespace-pre-wrap">{guarantor.notes}</p>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-150 p-5 shadow-sm flex-1 flex flex-col min-h-[250px]">
                <h4 className="finance-small-label text-slate-900 uppercase border-b border-slate-100 pb-2 mb-3 flex justify-between items-center">
                  <span>LINKED LOANS</span>
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {loans.length} TOTAL
                  </span>
                </h4>
                
                {loading ? (
                  <div className="flex items-center justify-center flex-1">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-slate-900"></div>
                  </div>
                ) : loans.length === 0 ? (
                  <div className="flex items-center justify-center flex-1 text-slate-400 finance-input">
                    No linked loans found for this guarantor.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-2 finance-caption uppercase text-slate-500 font-medium">Loan No</th>
                          <th className="py-2 finance-caption uppercase text-slate-500 font-medium">Customer</th>
                          <th className="py-2 finance-caption uppercase text-slate-500 font-medium text-right">Amount</th>
                          <th className="py-2 finance-caption uppercase text-slate-500 font-medium text-center">Status</th>
                          <th className="py-2 finance-caption uppercase text-slate-500 font-medium text-right">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {loans.map(loan => (
                          <tr key={loan.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 font-mono finance-input text-slate-800">#{loan.loan_id}</td>
                            <td className="py-2.5 finance-input text-slate-800">{loan.finance_customers?.name || 'Unknown'}</td>
                            <td className="py-2.5 finance-input text-slate-800 text-right">₹{Number(loan.amount).toLocaleString('en-IN')}</td>
                            <td className="py-2.5 text-center">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                loan.status === 'Closed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
                              }`}>
                                {loan.status}
                              </span>
                            </td>
                            <td className="py-2.5 finance-caption text-slate-500 text-right">
                              {new Date(loan.date).toLocaleDateString('en-GB')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ViewGuarantorModal;
