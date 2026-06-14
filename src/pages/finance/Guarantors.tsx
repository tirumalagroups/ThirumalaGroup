import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/UI/Card';
import { supabaseFinance, FinanceGuarantor } from '../../lib/supabaseFinance';
import { supabase } from '../../lib/supabase';
import { 
  User, 
  Phone, 
  MapPin, 
  Search, 
  Edit2, 
  Trash2, 
  Plus, 
  ArrowLeft, 
  RefreshCw, 
  Info,
  Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import ViewGuarantorModal from '../../components/finance/ViewGuarantorModal';

const Guarantors: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [guarantors, setGuarantors] = useState<FinanceGuarantor[]>([]);
  const [linkedLoanCounts, setLinkedLoanCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'Latest' | 'Name' | 'Guarantor ID'>('Latest');

  // View Modal State
  const [viewGuarantor, setViewGuarantor] = useState<FinanceGuarantor | null>(null);

  useEffect(() => {
    fetchGuarantors();
  }, []);

  const fetchGuarantors = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getGuarantors();
      setGuarantors(data);
      
      // Fetch loan counts
      const counts: Record<string, number> = {};
      
      // We can query counts but for scale, assuming getGuarantors might eventually paginate, 
      // here we query all loans to count them, or we could do a grouped query.
      const { data: loans, error } = await supabase
        .from('finance_loans')
        .select('guarantor_1_id, guarantor_2_id');
        
      if (!error && loans) {
        loans.forEach(l => {
          if (l.guarantor_1_id) counts[l.guarantor_1_id] = (counts[l.guarantor_1_id] || 0) + 1;
          if (l.guarantor_2_id) counts[l.guarantor_2_id] = (counts[l.guarantor_2_id] || 0) + 1;
        });
      }
      setLinkedLoanCounts(counts);

    } catch (err) {
      console.error(err);
      toast.error('Failed to load guarantors list');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (linkedLoanCounts[id] > 0) {
      toast.error(`Cannot delete: ${name} is linked to active loans.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete guarantor ${name}?`)) {
      return;
    }
    const deleteToastId = toast.loading(`Deleting guarantor profile...`);
    try {
      const staffName = user?.username || 'Staff';
      const success = await supabaseFinance.deleteGuarantor(id, staffName);
      if (success) {
        toast.success(`Guarantor ${name} deleted successfully`, { id: deleteToastId });
        fetchGuarantors();
      } else {
        toast.error('Delete failed. Verify guarantor has no linked active loans.', { id: deleteToastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong during deletion', { id: deleteToastId });
    }
  };

  // Search & Filtering calculations
  const filteredGuarantors = useMemo(() => {
    let result = [...guarantors];

    // 1. Search Query filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(g => {
        const idStr = String(g.guarantor_id || '').toLowerCase();
        const nameStr = (g.name || '').toLowerCase();
        const phoneStr = (g.phone || '').toLowerCase();
        const phone2Str = (g.phone_2 || '').toLowerCase();
        const aadhaarStr = (g.aadhaar || '').toLowerCase();
        const villageStr = (g.permanent_village || g.village || '').toLowerCase();
        const mandalStr = (g.permanent_mandal || g.mandal || '').toLowerCase();
        const districtStr = (g.permanent_district || g.district || '').toLowerCase();
        const pAddrStr = (g.permanent_address || g.aadhaar_address || '').toLowerCase();
        const cAddrStr = (g.current_address || g.present_address || '').toLowerCase();
        const cVillageStr = (g.current_village || '').toLowerCase();
        const cMandalStr = (g.current_mandal || '').toLowerCase();
        const cDistrictStr = (g.current_district || '').toLowerCase();

        return (
          idStr.includes(query) ||
          nameStr.includes(query) ||
          phoneStr.includes(query) ||
          phone2Str.includes(query) ||
          aadhaarStr.includes(query) ||
          villageStr.includes(query) ||
          mandalStr.includes(query) ||
          districtStr.includes(query) ||
          pAddrStr.includes(query) ||
          cAddrStr.includes(query) ||
          cVillageStr.includes(query) ||
          cMandalStr.includes(query) ||
          cDistrictStr.includes(query)
        );
      });
    }

    // 2. Sorting logic
    if (sortBy === 'Name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'Guarantor ID') {
      result.sort((a, b) => (Number(a.guarantor_id) || 0) - (Number(b.guarantor_id) || 0));
    } else {
      // Latest
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [guarantors, searchQuery, sortBy]);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <div className="text-slate-400 flex items-center gap-1.5 finance-small-label uppercase">
            <span>DASHBOARD</span>
            <span>/</span>
            <span className="text-slate-600">GUARANTORS</span>
          </div>
          <h1 className="mt-1 finance-h1">GUARANTORS</h1>
          <p className="mt-0.5 finance-small-label uppercase">
            VIEW, SEARCH, AND MANAGE GUARANTOR MASTER RECORDS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/finance')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK
          </button>
          <button
            onClick={fetchGuarantors}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm finance-button uppercase"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            REFRESH
          </button>
          <button
            onClick={() => navigate('/finance/new-guarantor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <Plus className="w-3.5 h-3.5" />
            NEW GUARANTOR
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="shadow-sm border-slate-150 rounded-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search box */}
          <div className="md:col-span-2 relative">
            <label className="finance-caption uppercase">
              SEARCH GUARANTORS
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, phone, Aadhaar UID, village, id..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-slate-850 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-950 shadow-sm finance-header-time"
              />
            </div>
          </div>

          {/* Sort selection */}
          <div>
            <label className="finance-caption uppercase">
              SORT BY
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'Latest' | 'Name' | 'Guarantor ID')}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-855 focus:ring-1 focus:ring-slate-955 focus:outline-none h-9 shadow-sm finance-header-time"
            >
              <option value="Latest">LATEST REGISTERED</option>
              <option value="Name">GUARANTOR NAME</option>
              <option value="Guarantor ID">GUARANTOR ID</option>
            </select>
          </div>

        </div>
      </Card>

      {/* Main List Card */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-slate-900"></div>
          <p className="text-slate-500 finance-section-heading">Loading guarantors database...</p>
        </div>
      ) : filteredGuarantors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-150 shadow-sm space-y-4">
          <div className="p-4 bg-slate-50 rounded-full border border-slate-100 max-w-fit mx-auto">
            <Info className="w-12 h-12 text-slate-350" />
          </div>
          <h2 className="finance-section-heading uppercase">NO GUARANTORS</h2>
          <p className="max-w-sm mx-auto finance-small-label uppercase">
            Create your first guarantor record.
          </p>
          <button
            onClick={() => navigate('/finance/new-guarantor')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1329] text-white border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors shadow-sm finance-button uppercase"
          >
            <Plus className="w-3.5 h-3.5" />
            ADD GUARANTOR
          </button>
        </div>
      ) : (
        <Card 
          title={<span className="text-slate-900 finance-header-time uppercase">GUARANTORS DATABASE</span>}
          subtitle={<span className="text-slate-400 finance-small-label uppercase">LIST OF REGISTERED GUARANTORS</span>}
          className="shadow-sm border-slate-150 rounded-xl"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150 md:text-sm finance-caption">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="finance-small-label uppercase">S.No</th>
                  <th className="finance-small-label uppercase">Guarantor ID</th>
                  <th className="finance-small-label uppercase">Photo</th>
                  <th className="finance-small-label uppercase">Name</th>
                  <th className="finance-small-label uppercase">Aadhaar</th>
                  <th className="finance-small-label uppercase">Contact Info</th>
                  <th className="finance-small-label uppercase">Origin / Address</th>
                  <th className="finance-small-label uppercase text-center">Linked Loans</th>
                  <th className="text-right finance-small-label uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredGuarantors.map((guar, index) => (
                  <tr key={guar.id} className="hover:bg-slate-50/20">
                    <td className="px-3 py-3 text-slate-500 finance-input">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-800 finance-input">
                      #{guar.guarantor_id || '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full border overflow-hidden bg-slate-50 flex items-center justify-center shrink-0 shadow-inner">
                        {guar.photo_url ? (
                          <img
                            src={guar.photo_url}
                            alt={guar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-slate-450" />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-900 finance-input">
                      {guar.name}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-650 finance-input">
                      {guar.aadhaar ? guar.aadhaar.replace(/(\d{4})/g, '$1 ').trim() : '—'}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col text-slate-700">
                        <span className="flex items-center gap-1 finance-input">
                          <Phone className="w-3 h-3 text-slate-450" />
                          {guar.phone || 'N/A'}
                        </span>
                        {guar.phone_2 && (
                          <span className="text-slate-400 mt-0.5 finance-small-label">
                            {guar.phone_2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600 max-w-xs truncate finance-input">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5" title={(guar.permanent_village || guar.village) ? `${guar.permanent_village || guar.village}, ${guar.permanent_mandal || guar.mandal}` : 'N/A'}>
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium text-slate-700">
                            {[guar.permanent_village || guar.village, guar.permanent_mandal || guar.mandal].filter(Boolean).join(', ') || '—'}
                          </span>
                        </div>
                        <span className="truncate text-xs text-slate-400 pl-5" title={guar.permanent_address || guar.aadhaar_address || ''}>
                          {guar.permanent_address || guar.aadhaar_address || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-1 bg-slate-100 text-slate-600 rounded-md finance-header-time">
                        {linkedLoanCounts[guar.id] || 0}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setViewGuarantor(guar)}
                          title="View Details"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => navigate(`/finance/new-guarantor?edit=${guar.id}`)}
                          title="Edit Guarantor"
                          className="p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(guar.id, guar.name)}
                          title="Delete Guarantor"
                          className="p-1.5 text-red-650 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewGuarantor && (
        <ViewGuarantorModal 
          guarantor={viewGuarantor} 
          onClose={() => setViewGuarantor(null)} 
        />
      )}
    </div>
  );
};

export default Guarantors;
