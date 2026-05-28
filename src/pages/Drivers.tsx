import React, { useState, useEffect } from 'react';
import Card from '../components/UI/Card';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import { Driver } from '../lib/supabaseDatabase';
import { supabaseDB } from '../lib/supabaseDatabase';
import { useTableMode } from '../contexts/TableModeContext';
import toast from 'react-hot-toast';
import ModeLabel from '../components/UI/ModeLabel';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Edit } from 'lucide-react';

const Drivers: React.FC = () => {
  const { mode: tableMode } = useTableMode();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(false);

  // Driver state according to schema
  const [newDriver, setNewDriver] = useState({
    driver_name: '',
    license_no: '',
    exp_date: '',
    particulars: '',
    phone: '',
    address: '',
  });

  const [licenseFrontFile, setLicenseFrontFile] = useState<File | null>(null);
  const [licenseBackFile, setLicenseBackFile] = useState<File | null>(null);
  // Update imageModal state to support both front and back
  const [imageModal, setImageModal] = useState<null | {
    url: string;
    label: string;
    front?: string;
    back?: string;
    driverName?: string;
  }>(null);

  useEffect(() => {
    loadDrivers();
  }, [tableMode]);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const driversData = await supabaseDB.getDrivers();
      setDrivers(driversData);
    } catch (error) {
      console.error('Error loading drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };



  const handleInputChange = (field: string, value: string) => {
    if (editingDriver) {
      setEditingDriver({ ...editingDriver, [field]: value });
    } else {
      setNewDriver({ ...newDriver, [field]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let licenseFrontUrl = '';
      let licenseBackUrl = '';
      // Upload License Front Photo
      if (licenseFrontFile) {
        const { data, error } = await supabase.storage
          .from('driver-license')
          .upload(
            `license-front-${Date.now()}-${licenseFrontFile.name}`,
            licenseFrontFile
          );
        if (error) throw error;
        licenseFrontUrl = supabase.storage
          .from('driver-license')
          .getPublicUrl(data.path).data.publicUrl;
      }
      // Upload License Back Photo
      if (licenseBackFile) {
        const { data, error } = await supabase.storage
          .from('driver-license')
          .upload(
            `license-back-${Date.now()}-${licenseBackFile.name}`,
            licenseBackFile
          );
        if (error) throw error;
        licenseBackUrl = supabase.storage
          .from('driver-license')
          .getPublicUrl(data.path).data.publicUrl;
      }
      if (editingDriver) {
        // Update existing driver
        const updatedDriver = await supabaseDB.updateDriver(editingDriver.id, {
          ...editingDriver,
          license_front_url: licenseFrontUrl || editingDriver.license_front_url,
          license_back_url: licenseBackUrl || editingDriver.license_back_url,
        });
        if (updatedDriver) {
          await loadDrivers();
          setEditingDriver(null);
          toast.success('Driver updated successfully!');
        } else {
          toast.error('Failed to update driver');
        }
      } else {
        // Add new driver
        const nextSno = drivers.length > 0 ? Math.max(...drivers.map(d => d.sno || 0)) + 1 : 1;
        const newDriverData = await supabaseDB.addDriver({
          ...newDriver,
          sno: nextSno,
          license_front_url: licenseFrontUrl,
          license_back_url: licenseBackUrl,
        });
        if (newDriverData) {
          await loadDrivers();
          setNewDriver({
            driver_name: '',
            license_no: '',
            exp_date: '',
            particulars: '',
            phone: '',
            address: '',
          });
          setLicenseFrontFile(null);
          setLicenseBackFile(null);
          setShowAddForm(false);
          toast.success('Driver added successfully!');
        } else {
          toast.error('Failed to add driver');
        }
      }
    } catch (error) {
      console.error('Error saving driver:', error);
      toast.error('Failed to save driver');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver({ ...driver });
    setShowAddForm(false);
  };

  return (
    <div className='min-h-screen flex flex-col'>
      {/* Page content */}
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3 mb-1'>
              <h1 className='text-2xl font-bold text-gray-900'>
                Drivers Management
              </h1>
              <ModeLabel />
            </div>
            <p className='text-gray-600'>
              Track driver information and license expiry dates
            </p>
          </div>

          <Button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingDriver(null);
            }}
          >
            Add Driver
          </Button>
        </div>

        {/* Add/Edit Driver Form */}
        {(showAddForm || editingDriver) && (
          <Card title={editingDriver ? 'Edit Driver' : 'Add New Driver'}>
            <form onSubmit={handleSubmit} className='space-y-4'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='Driver Name'
                  value={
                    editingDriver
                      ? editingDriver.driver_name
                      : newDriver.driver_name
                  }
                  onChange={value => handleInputChange('driver_name', value)}
                  placeholder='Enter driver name'
                  required
                />
                <Input
                  label='License Number'
                  value={
                    (editingDriver
                      ? editingDriver.license_no
                      : newDriver.license_no) ?? ''
                  }
                  onChange={value => handleInputChange('license_no', value)}
                  placeholder='License number'
                />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='License Expiry Date'
                  type='date'
                  value={
                    (editingDriver ? editingDriver.exp_date : newDriver.exp_date) ?? ''
                  }
                  onChange={value => handleInputChange('exp_date', value)}
                />
                <Input
                  label='Phone'
                  value={(editingDriver ? editingDriver.phone : newDriver.phone) ?? ''}
                  onChange={value => handleInputChange('phone', value)}
                  placeholder='Phone number'
                />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <Input
                  label='Address'
                  value={
                    (editingDriver ? editingDriver.address : newDriver.address) ?? ''
                  }
                  onChange={value => handleInputChange('address', value)}
                  placeholder='Driver address...'
                />
                <Input
                  label='Particulars'
                  value={
                    (editingDriver
                      ? editingDriver.particulars
                      : newDriver.particulars) ?? ''
                  }
                  onChange={value => handleInputChange('particulars', value)}
                  placeholder='Description...'
                />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    License Front Photo
                  </label>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={e =>
                      setLicenseFrontFile(
                        e.target.files && e.target.files[0]
                          ? e.target.files[0]
                          : null
                      )
                    }
                    className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>
                    License Back Photo
                  </label>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={e =>
                      setLicenseBackFile(
                        e.target.files && e.target.files[0]
                          ? e.target.files[0]
                          : null
                      )
                    }
                    className='block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100'
                  />
                </div>
              </div>
              <div className='flex gap-4'>
                <Button type='submit' disabled={loading}>
                  {loading
                    ? 'Saving...'
                    : editingDriver
                      ? 'Update Driver'
                      : 'Add Driver'}
                </Button>
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingDriver(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Drivers List */}
        <Card
          title='Drivers List'
          subtitle={`${drivers.length} drivers registered`}
        >
          <div className='overflow-x-auto'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50 border-b border-gray-200'>
                <tr>
                  <th className='px-3 py-2 text-left font-bold text-blue-700'>
                    S.No
                  </th>
                  <th className='px-3 py-2 text-left font-bold text-blue-700'>
                    Driver Name
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    License Number
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    License Expiry
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Phone
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Address
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-700'>
                    Particulars
                  </th>
                  {/* Remove license photo thumbnails from table, add Eye icon button for viewing */}
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    License Photos
                  </th>
                  <th className='px-3 py-2 text-center font-medium text-gray-700'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(driver => (
                  <tr
                    key={driver.id}
                    className='border-b hover:bg-gray-50 transition-colors'
                  >
                    <td className='px-3 py-2 font-medium'>{driver.sno}</td>
                    <td className='px-3 py-2 font-bold text-blue-700'>
                      {driver.driver_name}
                    </td>
                    <td className='px-3 py-2'>{driver.license_no}</td>
                    <td className='px-3 py-2'>
                      {driver.exp_date
                        ? format(new Date(driver.exp_date), 'dd-MM-yyyy')
                        : '-'}
                    </td>
                    <td className='px-3 py-2'>{driver.phone}</td>
                    <td className='px-3 py-2'>{driver.address}</td>
                    <td className='px-3 py-2'>{driver.particulars}</td>
                    <td className='px-3 py-2 text-center'>
                      <Button
                        size='sm'
                        variant='secondary'
                        onClick={() =>
                          setImageModal({
                            url: '',
                            label: 'License Photos',
                            front: driver.license_front_url || '',
                            back: driver.license_back_url || '',
                            driverName: driver.driver_name,
                          })
                        }
                        disabled={
                          !driver.license_front_url && !driver.license_back_url
                        }
                      >
                        View
                      </Button>
                    </td>
                    <td className='px-3 py-2 text-center'>
                      <div className='flex items-center gap-2'>
                        <Button
                          size='sm'
                          variant='secondary'
                          icon={Edit}
                          onClick={() => handleEdit(driver)}
                        >
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        {/* Image Modal for separate viewing of both photos */}
        {imageModal && (imageModal.front || imageModal.back) && (
          <div
            className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80'
            onClick={() => setImageModal(null)}
          >
            <div
              className='relative max-w-2xl w-full p-4'
              onClick={e => e.stopPropagation()}
            >
              <button
                className='absolute top-2 right-2 bg-white rounded-full p-2 shadow hover:bg-gray-100'
                onClick={() => setImageModal(null)}
              >
                <span className='sr-only'>Close</span>
                <svg
                  className='w-6 h-6 text-gray-700'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </button>
              <div className='flex flex-col items-center'>
                <div className='mb-4 text-white text-lg font-semibold text-center'>
                  {imageModal.driverName} - License Photos
                </div>
                <div className='flex flex-col md:flex-row gap-6 items-center'>
                  {imageModal.front && (
                    <div className='flex flex-col items-center'>
                      <div className='mb-2 text-sm text-gray-200 font-medium'>
                        Front
                      </div>
                      <img
                        src={imageModal.front}
                        alt='License Front'
                        className='w-full max-w-xs h-auto aspect-[4/3] object-contain rounded-xl shadow-lg border-2 border-blue-300'
                      />
                    </div>
                  )}
                  {imageModal.back && (
                    <div className='flex flex-col items-center'>
                      <div className='mb-2 text-sm text-gray-200 font-medium'>
                        Back
                      </div>
                      <img
                        src={imageModal.back}
                        alt='License Back'
                        className='w-full max-w-xs h-auto aspect-[4/3] object-contain rounded-xl shadow-lg border-2 border-blue-300'
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Drivers;
