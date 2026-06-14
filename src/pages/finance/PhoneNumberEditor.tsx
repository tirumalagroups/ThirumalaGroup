import React, { useEffect, useState } from 'react';
import Card from '../../components/UI/Card';
import Input from '../../components/UI/Input';
import Button from '../../components/UI/Button';
import { supabaseFinance, FinanceCustomer } from '../../lib/supabaseFinance';
import { Phone, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const PhoneNumberEditor: React.FC = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<FinanceCustomer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCusts, setFilteredCusts] = useState<FinanceCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<FinanceCustomer | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredCusts(customers);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = customers.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.aadhaar && c.aadhaar.includes(q))
    );
    setFilteredCusts(filtered);
  }, [searchQuery, customers]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await supabaseFinance.getCustomers();
      setCustomers(data);
      setFilteredCusts(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (cust: FinanceCustomer) => {
    setSelectedCustomer(cust);
    setNewPhone(cust.phone || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    try {
      const staffName = user?.username || 'Staff';
      const updated = await supabaseFinance.updateCustomer(selectedCustomer.id, {
        phone: newPhone || null
      }, staffName);

      if (updated) {
        toast.success(`Phone updated for ${selectedCustomer.name}`);
        setSelectedCustomer(null);
        fetchCustomers();
      } else {
        toast.error('Failed to update phone');
      }
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-green-100 pb-4">
        <div>
          <h1 className="finance-h1">Phone Number Editor</h1>
          <p className="finance-small-label uppercase">Quickly search and update contact details for customers in the finance registry</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Editor Form */}
        <Card title="Edit Contact Details" subtitle="Input new phone details">
          {selectedCustomer ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="p-3 bg-gray-50 rounded space-y-1 finance-caption">
                <p className="text-gray-900 finance-sidebar-link">{selectedCustomer.name}</p>
                <p className="text-gray-500">Current Phone: <span className="finance-input">{selectedCustomer.phone || 'None'}</span></p>
                {selectedCustomer.aadhaar && (
                  <p className="text-gray-500 font-mono">Aadhaar UID: {selectedCustomer.aadhaar}</p>
                )}
              </div>
              <Input
                label="New Phone Number *"
                value={newPhone}
                onChange={setNewPhone}
                placeholder="Enter 10 digit contact phone"
                required
              />
              <div className="flex gap-2">
                <Button type="submit" variant="success" className="flex-1" icon={Save}>
                  Save Phone
                </Button>
                <Button onClick={() => setSelectedCustomer(null)} variant="secondary">
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="text-center py-8 text-gray-400 finance-input">
              Please select a customer from the list on the right to edit their phone number.
            </div>
          )}
        </Card>

        {/* Search List */}
        <Card title="Customer Directory Index" subtitle="Search and select customer accounts to edit" className="md:col-span-2 shadow">
          <div className="mb-4">
            <Input
              label="Filter Directory"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by customer name, phone, Aadhaar..."
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-green-500"></div>
            </div>
          ) : filteredCusts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No matching customers found</div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 md:text-sm finance-caption">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="finance-small-label uppercase">Customer Name</th>
                    <th className="finance-small-label uppercase">Aadhaar UID</th>
                    <th className="finance-small-label uppercase">Phone Number</th>
                    <th className="text-right finance-small-label uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredCusts.map(cust => (
                    <tr key={cust.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 text-gray-900 finance-input">{cust.name}</td>
                      <td className="px-3 py-3 text-gray-600 font-mono">{cust.aadhaar || '-'}</td>
                      <td className="px-3 py-3 text-gray-600 font-mono">{cust.phone || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          onClick={() => handleSelect(cust)}
                          variant="primary"
                          size="sm"
                          icon={Phone}
                        >
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PhoneNumberEditor;
