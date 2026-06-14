import * as XLSX from 'xlsx';

export interface ExcelData {
  [key: string]: any;
}

export const exportToExcel = (
  data: ExcelData[],
  filename: string,
  sheetName: string = 'Sheet1',
  options?: { skipHeader?: boolean }
) => {
  try {
    // Create a new workbook
    const workbook = XLSX.utils.book_new();

    // Convert data to worksheet
    const worksheet = XLSX.utils.json_to_sheet(data, options);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Save file
    XLSX.writeFile(workbook, `${filename}.xlsx`);

    return { success: true };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: 'Failed to export to Excel' };
  }
};

// Enhanced export with multiple sheets
export const exportToExcelMultiSheet = (
  sheets: { name: string; data: ExcelData[] }[],
  filename: string
) => {
  try {
    const workbook = XLSX.utils.book_new();

    sheets.forEach(sheet => {
      const worksheet = XLSX.utils.json_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return { success: true };
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    return { success: false, error: 'Failed to export to Excel' };
  }
};

// Export to CSV
export const exportToCSV = (data: ExcelData[], filename: string) => {
  try {
    if (data.length === 0) {
      return { success: false, error: 'No data to export' };
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const value = row[header];
            // Escape commas and quotes
            const escapedValue = String(value).replace(/"/g, '""');
            return `"${escapedValue}"`;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    return { success: false, error: 'Failed to export to CSV' };
  }
};

// Import from Excel/CSV
export const importFromFile = (
  file: File
): Promise<{ success: boolean; data?: ExcelData[]; error?: string }> => {
  return new Promise(resolve => {
    const reader = new FileReader();

    reader.onload = e => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({ success: false, error: 'Failed to read file' });
          return;
        }

        let workbook: XLSX.WorkBook;

        if (file.name.endsWith('.csv')) {
          // Handle CSV
          const csvData = new Uint8Array(data as ArrayBuffer);
          workbook = XLSX.read(csvData, { type: 'array' });
        } else {
          // Handle Excel files
          workbook = XLSX.read(data, { type: 'binary' });
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        resolve({ success: true, data: jsonData as ExcelData[] });
      } catch (error) {
        console.error('Error importing file:', error);
        resolve({ success: false, error: 'Failed to import file' });
      }
    };

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' });
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};

// Validate imported data
export const validateImportedData = (
  data: ExcelData[],
  requiredFields: string[],
  _optionalFields: string[] = []
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    errors.push('No data found in file');
    return { isValid: false, errors, warnings };
  }

  // Check required fields
  const firstRow = data[0];
  const missingFields = requiredFields.filter(field => !(field in firstRow));

  if (missingFields.length > 0) {
    errors.push(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Check data types and values
  data.forEach((row, index) => {
    // Check for empty required fields
    requiredFields.forEach(field => {
      if (!row[field] || String(row[field]).trim() === '') {
        errors.push(
          `Row ${index + 1}: Missing value for required field '${field}'`
        );
      }
    });

    // Check for numeric fields
    ['credit', 'debit', 'amount', 'quantity'].forEach(field => {
      if (field in row && row[field] !== undefined && row[field] !== null) {
        const value = parseFloat(String(row[field]));
        if (isNaN(value)) {
          warnings.push(`Row ${index + 1}: Field '${field}' should be numeric`);
        }
      }
    });

    // Check for date fields
    ['date', 'expiry_date', 'issue_date'].forEach(field => {
      if (field in row && row[field] !== undefined && row[field] !== null) {
        const dateValue = new Date(String(row[field]));
        if (isNaN(dateValue.getTime())) {
          warnings.push(
            `Row ${index + 1}: Field '${field}' should be a valid date`
          );
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export const formatDataForExcel = (
  data: any[],
  type:
    | 'cashbook'
    | 'ledger'
    | 'balancesheet'
    | 'vehicles'
    | 'bankguarantees'
    | 'drivers'
) => {
  switch (type) {
    case 'cashbook':
      return data.map(item => ({
        'S.No': item.sno,
        Date: item.c_date,
        Company: item.company_name,
        Account: item.acc_name,
        'Sub Account': item.sub_acc_name || '',
        Particulars: item.particulars,
        Credit: item.credit || 0,
        Debit: item.debit || 0,
        'Sale Qty': item.sale_qty || 0,
        'Purchase Qty': item.purchase_qty || 0,
        Staff: item.staff,
        'Entry Time': item.entry_time,
        Approved: item.approved ? 'Yes' : 'No',
        Locked: item.lock_record ? 'Yes' : 'No',
      }));

    case 'ledger':
      return data.map(item => ({
        'Account Name': item.acc_name,
        Credit: item.credit || 0,
        Debit: item.debit || 0,
        Balance: item.balance || 0,
        Status: item.yes_no || '',
      }));

    case 'balancesheet':
      return data.map(item => ({
        'Account Name': item.acc_name,
        Credit: item.credit || 0,
        Debit: item.debit || 0,
        Balance: item.balance || 0,
        Category: item.yes_no || '',
        Result: item.result || '',
      }));

    case 'vehicles':
      return data.map(item => ({
        'S.No': item.sno,
        'Vehicle No': item.v_no,
        Type: item.v_type,
        Particulars: item.particulars,
        'Tax Expiry': item.tax_exp_date,
        'Insurance Expiry': item.insurance_exp_date,
        'Fitness Expiry': item.fitness_exp_date,
        'Permit Expiry': item.permit_exp_date,
        'Date Added': item.date_added,
      }));

    case 'bankguarantees':
      return data.map(item => ({
        'S.No': item.sno,
        'BG No': item.bg_no,
        'Issue Date': item.issue_date,
        'Expiry Date': item.exp_date,
        'Work Name': item.work_name,
        Credit: item.credit || 0,
        Debit: item.debit || 0,
        Department: item.department,
        Status: item.cancelled ? 'Cancelled' : 'Active',
      }));

    case 'drivers':
      return data.map(item => ({
        'S.No': item.sno,
        'Driver Name': item.driver_name,
        'License No': item.license_no,
        'License Expiry': item.exp_date,
        Phone: item.phone,
        Address: item.address,
        Particulars: item.particulars,
      }));

    default:
      return data;
  }
};
