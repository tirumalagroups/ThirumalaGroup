import { format } from 'date-fns';

export interface PrintOptions {
  title?: string;
  subtitle?: string;
  orientation?: 'portrait' | 'landscape';
  paperSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
  includeHeader?: boolean;
  includeFooter?: boolean;
  headerText?: string;
  footerText?: string;
  openingBalance?: number;
  closingBalance?: number;
  companyBalances?: Array<{companyName: string, openingBalance: number, closingBalance: number}>;
  isPrintMode?: boolean;
}

export interface SharedPrintStyleOptions {
  isLandscape?: boolean;
}

export const getSharedPrintStyles = (options?: SharedPrintStyleOptions) => {
  const isLandscape = options?.isLandscape ?? false;
  return `
    body {
      font-family: Arial, sans-serif;
      font-size: ${isLandscape ? '12pt' : '11pt'};
      line-height: 1.4;
      margin: 0;
      padding: ${isLandscape ? '15px' : '8px'};
      background-color: #fff;
      color: #000;
    }
    
    table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    
    th, td {
      border: 1.5px solid #000;
      padding: ${isLandscape ? '5px 4px' : '4px 3px'};
      font-size: ${isLandscape ? '12pt' : '11pt'};
      line-height: 1.3;
      box-sizing: border-box;
      word-wrap: break-word;
      overflow: hidden;
      font-weight: bold;
    }
    
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: left;
    }
    
    /* Column widths and wrapping behaviors adjusted for portrait compatibility */
    .col-sno {
      width: ${isLandscape ? '45px' : '30px'} !important;
    }
    .col-date {
      width: ${isLandscape ? '90px' : '65px'} !important;
    }
    .col-qty, .col-purchase-qty, .col-sale-qty {
      width: ${isLandscape ? '80px' : '55px'} !important;
      white-space: normal !important;
      text-align: center !important;
    }
    .col-credit {
      width: ${isLandscape ? '110px' : '75px'} !important;
      min-width: ${isLandscape ? '110px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    .col-debit {
      width: ${isLandscape ? '110px' : '75px'} !important;
      min-width: ${isLandscape ? '110px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    .col-balance {
      width: ${isLandscape ? '130px' : '85px'} !important;
      min-width: ${isLandscape ? '130px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    .col-amount {
      width: ${isLandscape ? '130px' : '85px'} !important;
      min-width: ${isLandscape ? '130px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    .col-opening-balance, .col-opening {
      width: ${isLandscape ? '130px' : '85px'} !important;
      min-width: ${isLandscape ? '130px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    .col-closing-balance, .col-closing {
      width: ${isLandscape ? '130px' : '85px'} !important;
      min-width: ${isLandscape ? '130px' : 'unset'} !important;
      white-space: normal !important;
      text-align: right !important;
    }
    
    .col-particulars {
      width: auto !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }
    .col-company {
      width: auto !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }
    .col-account {
      width: auto !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }
    .col-sub-account {
      width: auto !important;
      white-space: normal !important;
      word-wrap: break-word !important;
    }
    .col-status {
      width: ${isLandscape ? '90px' : '65px'} !important;
      white-space: normal !important;
      text-align: center !important;
    }

    .text-right {
      text-align: right !important;
    }
    .text-center {
      text-align: center !important;
    }
    .text-bold {
      font-weight: bold !important;
    }
    .approved {
      background-color: #d1fae5 !important;
    }
    .pending {
      background-color: #fef3c7 !important;
    }

    @media print {
      @page {
        size: A4 ${isLandscape ? 'landscape' : 'portrait'};
        margin: ${isLandscape ? '8mm' : '5mm'};
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        font-size: ${isLandscape ? '12pt' : '11pt'} !important;
      }
      th {
        background-color: #f3f4f6 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .approved {
        background-color: #d1fae5 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pending {
        background-color: #fef3c7 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;
};

export const getColClass = (key: string) => {
  const k = key.toLowerCase();
  if (k === 'sno' || k === 's_no' || k === 's.no') return 'col-sno';
  if (k === 'date' || k === 'c_date' || k === 'date') return 'col-date';
  if (k === 'credit') return 'col-credit';
  if (k === 'debit') return 'col-debit';
  if (k === 'balance') return 'col-balance';
  if (k === 'amount') return 'col-amount';
  if (k.includes('purchaseqty') || k.includes('purchase_qty') || k.includes('purchase quantity') || k.includes('purchase quantity') || k === 'purchasequantity') return 'col-purchase-qty';
  if (k.includes('saleqty') || k.includes('sale_qty') || k.includes('sale quantity') || k === 'salequantity') return 'col-sale-qty';
  if (k.includes('qty')) return 'col-qty';
  if (k === 'particulars') return 'col-particulars';
  if (k === 'companyname' || k === 'company_name' || k === 'company') return 'col-company';
  if (k === 'accountname' || k === 'acc_name' || k === 'account') return 'col-account';
  if (k === 'subaccount' || k === 'sub_acc_name' || k === 'sub account') return 'col-sub-account';
  if (k === 'approved' || k === 'status') return 'col-status';
  return '';
};

export const printTable = (
  data: any[],
  columns: { key: string; label: string; width?: string }[],
  options: PrintOptions = {}
) => {
  const {
    title = 'Report',
    subtitle = '',
    orientation = 'portrait',
    paperSize = 'A4',
    margins = { top: '1in', right: '0.5in', bottom: '1in', left: '0.5in' },
    includeHeader = true,
    includeFooter = true,
    headerText = 'Thirumala Group Business Management System',
    footerText = `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
  } = options;

  // Create print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  // Generate CSS
  const css = `
    @media print {
      @page {
        size: ${paperSize} ${orientation};
        margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
      }
    }
    
    body {
      font-family: 'Arial', sans-serif;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    
    .print-header {
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .print-title {
      font-size: 24px;
      font-weight: bold;
      color: #333;
      margin: 0;
    }
    
    .print-subtitle {
      font-size: 16px;
      color: #666;
      margin: 5px 0 0 0;
    }
    
    .print-header-text {
      font-size: 14px;
      color: #333;
      margin: 10px 0 0 0;
    }
    
    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .print-table th {
      background-color: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 8px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
    }
    
    .print-table td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      font-size: 10px;
    }
    
    .print-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    .print-footer {
      text-align: center;
      border-top: 1px solid #333;
      padding-top: 10px;
      margin-top: 20px;
      font-size: 10px;
      color: #666;
    }
    
    .print-summary {
      margin: 0 auto 0 0;
      padding: 15px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      width: fit-content;
      max-width: 100%;
      margin-left: auto !important;
      margin-right: 0 !important;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .print-summary h3 {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #333;
    }
    
    .print-summary-row {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
      font-size: 11px;
    }
    
    .print-summary-label {
      font-weight: bold;
      color: #555;
    }
    
    .print-summary-value {
      color: #333;
    }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    .text-green { color: #059669; }
    .text-red { color: #dc2626; }
    .text-orange { color: #ea580c; }
    ${getSharedPrintStyles({ isLandscape: orientation === 'landscape' })}
  `;

  const tableRows = data
    .map(row => {
      const cells = columns
        .map(col => {
          const value = row[col.key];
          let displayValue = value;

          if (typeof value === 'number') {
            if (
              col.key.toLowerCase().includes('amount') ||
              col.key.toLowerCase().includes('credit') ||
              col.key.toLowerCase().includes('debit') ||
              col.key.toLowerCase().includes('balance')
            ) {
              displayValue = `${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
            } else {
              displayValue = value.toLocaleString('en-IN');
            }
          }

          if (col.key.toLowerCase().includes('date') && value) {
            try {
              displayValue = format(new Date(value), 'dd/MM/yyyy');
            } catch (e) {
              displayValue = value;
            }
          }

          return `<td class="${getColClass(col.key)}">${displayValue || ''}</td>`;
        })
        .join('');

      return `<tr>${cells}</tr>`;
    })
    .join('');

  const tableHeaders = columns
    .map(col => `<th class="${getColClass(col.key)}" style="width: ${col.width || 'auto'}">${col.label}</th>`)
    .join('');

  let summaryHTML = '';
  if (data.length > 0) {
    const numericColumns = columns.filter(
      col =>
        col.key.toLowerCase().includes('amount') ||
        col.key.toLowerCase().includes('credit') ||
        col.key.toLowerCase().includes('debit') ||
        col.key.toLowerCase().includes('balance')
    );

    if (numericColumns.length > 0) {
      const totals = numericColumns.map(col => {
        const total = data.reduce((sum, row) => {
          const value = parseFloat(row[col.key]) || 0;
          return sum + value;
        }, 0);
        return { label: col.label, total };
      });

      summaryHTML = `
        <div class="print-summary">
          <h3>Summary</h3>
          ${totals
            .map(
              item => `
            <div class="print-summary-row">
              <span class="print-summary-label">Total ${item.label}:</span>
              <span class="print-summary-value">${item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          `
            )
            .join('')}
          <div class="print-summary-row">
            <span class="print-summary-label">Total Records:</span>
            <span class="print-summary-value">${data.length}</span>
          </div>
        </div>
      `;
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>${css}</style>
    </head>
    <body>
      ${
        includeHeader
          ? `
        <div class="print-header">
          <h1 class="print-title">${title}</h1>
          ${subtitle ? `<p class="print-subtitle">${subtitle}</p>` : ''}
          <p class="print-header-text">${headerText}</p>
        </div>
      `
          : ''
      }
      
      ${summaryHTML}
      
      <table class="print-table">
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      ${
        includeFooter
          ? `
        <div class="print-footer">
          <p>${footerText}</p>
        </div>
      `
          : ''
      }
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
};

// Specialized print functions for different report types
export const printCashBook = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'date', label: 'Date', width: '100px' },
    { key: 'companyName', label: 'Company', width: '150px' },
    { key: 'accountName', label: 'Account', width: '150px' },
    { key: 'subAccount', label: 'Sub Account', width: '150px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
    { key: 'credit', label: 'Credit', width: '100px' },
    { key: 'debit', label: 'Debit', width: '100px' },
    { key: 'staff', label: 'Staff', width: '100px' },
    { key: 'approved', label: 'Status', width: '80px' },
  ];

  return printTable(data, columns, {
    title: 'Cash Book Report',
    subtitle: 'Financial Transaction Details',
    ...options,
  });
};

export const printLedger = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'accountName', label: 'Account Name', width: '200px' },
    { key: 'credit', label: 'Credit', width: '120px' },
    { key: 'debit', label: 'Debit', width: '120px' },
    { key: 'balance', label: 'Balance', width: '120px' },
    { key: 'yesNo', label: 'Category', width: '100px' },
  ];

  return printTable(data, columns, {
    title: 'Ledger Report',
    subtitle: 'Account-wise Summary',
    ...options,
  });
};

export const printBalanceSheet = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'accountName', label: 'Account Name', width: '250px' },
    { key: 'credit', label: 'Credit', width: '120px' },
    { key: 'debit', label: 'Debit', width: '120px' },
    { key: 'balance', label: 'Balance', width: '120px' },
    { key: 'yesNo', label: 'P&L', width: '80px' },
    { key: 'result', label: 'Result', width: '100px' },
  ];

  return printTable(data, columns, {
    title: 'Balance Sheet',
    subtitle: 'Financial Position Report',
    ...options,
  });
};

export const printVehicles = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'v_no', label: 'Vehicle No', width: '120px' },
    { key: 'v_type', label: 'Type', width: '150px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
    { key: 'tax_exp_date', label: 'Tax Expiry', width: '100px' },
    { key: 'insurance_exp_date', label: 'Insurance Expiry', width: '120px' },
    { key: 'fitness_exp_date', label: 'Fitness Expiry', width: '120px' },
    { key: 'permit_exp_date', label: 'Permit Expiry', width: '120px' },
  ];

  return printTable(data, columns, {
    title: 'Vehicle Management Report',
    subtitle: 'Fleet and Document Status',
    ...options,
  });
};

export const printBankGuarantees = (
  data: any[],
  options: PrintOptions = {}
) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'bg_no', label: 'BG No', width: '150px' },
    { key: 'issue_date', label: 'Issue Date', width: '100px' },
    { key: 'exp_date', label: 'Expiry Date', width: '100px' },
    { key: 'work_name', label: 'Work Name', width: '250px' },
    { key: 'credit', label: 'Credit', width: '100px' },
    { key: 'debit', label: 'Debit', width: '100px' },
    { key: 'department', label: 'Department', width: '150px' },
  ];

  return printTable(data, columns, {
    title: 'Bank Guarantees Report',
    subtitle: 'BG Tracking and Management',
    ...options,
  });
};

export const printDrivers = (data: any[], options: PrintOptions = {}) => {
  const columns = [
    { key: 'sno', label: 'S.No', width: '60px' },
    { key: 'driver_name', label: 'Driver Name', width: '200px' },
    { key: 'license_no', label: 'License No', width: '150px' },
    { key: 'exp_date', label: 'License Expiry', width: '120px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    { key: 'address', label: 'Address', width: '250px' },
    { key: 'particulars', label: 'Particulars', width: '200px' },
  ];

  return printTable(data, columns, {
    title: 'Drivers Report',
    subtitle: 'Driver Information and License Status',
    ...options,
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Specialized print function for Daily Reports with Thirumala Group branding
// FIX: Uses a single popup with direct window.print() — no second popup needed.
// ─────────────────────────────────────────────────────────────────────────────
export const printDailyReport = (data: any[], options: PrintOptions = {}) => {
  const {
    title = 'Daily Report',
    subtitle = '',
    orientation = 'portrait',
    paperSize = 'A4',
    margins = { top: '0.3in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    includeHeader = true,
    includeFooter = true,
    headerText = 'Thirumala Group - Daily Transaction Report',
    footerText = `Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
    openingBalance = 0,
    closingBalance = 0,
    companyBalances = [],
  } = options;

  // Open a single print window — no second popup required
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  const formatCurrency = (value: number) =>
    value.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Columns for the main table (Date and Staff excluded per business requirement)
  const columns = [
    { key: 'sno', label: 'S.No', width: '5%' },
    { key: 'companyName', label: 'Company', width: '15%' },
    { key: 'accountName', label: 'Account', width: '13%' },
    { key: 'subAccount', label: 'Sub Account', width: '12%' },
    { key: 'particulars', label: 'Particulars', width: '22%' },
    { key: 'credit', label: 'Credit', width: '11%' },
    { key: 'debit', label: 'Debit', width: '11%' },
    { key: 'approved', label: 'Status', width: '11%' },
  ];

  const filteredColumns = columns.filter(col => {
    if (!data || data.length === 0) return true;
    return Object.prototype.hasOwnProperty.call(data[0], col.key);
  });

  // Build table rows
  const tableRows = data
    .map((row, index) => {
      const cells = filteredColumns
        .map(col => {
          let value = row[col.key];
          if (col.key === 'sno') value = index + 1;
          let displayValue: string | number = value ?? '';

          if (typeof value === 'number') {
            if (
              col.key.toLowerCase().includes('credit') ||
              col.key.toLowerCase().includes('debit') ||
              col.key.toLowerCase().includes('balance') ||
              col.key.toLowerCase().includes('amount')
            ) {
              displayValue = value === 0 ? '-' : formatCurrency(value);
            } else {
              displayValue = value.toLocaleString('en-IN');
            }
          }

          if (col.key.toLowerCase().includes('date') && value) {
            try {
              displayValue = format(new Date(value), 'dd/MM/yyyy');
            } catch {
              displayValue = value;
            }
          }

          return `<td class="${getColClass(col.key)}">${displayValue}</td>`;
        })
        .join('');

      const rowBg = index % 2 === 0 ? '#fff' : '#f9fafb';
      return `<tr style="background:${rowBg};">${cells}</tr>`;
    })
    .join('');

  const tableHeaders = filteredColumns
    .map(
      col =>
        `<th class="${getColClass(col.key)}">${col.label}</th>`
    )
    .join('');

  // Calculate totals
  const creditTotal = data.reduce((sum, row) => {
    const v = row.credit;
    if (v === null || v === undefined || v === '') return sum;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const debitTotal = data.reduce((sum, row) => {
    const v = row.debit;
    if (v === null || v === undefined || v === '') return sum;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const openingBalanceValue = Math.abs(openingBalance);
  const closingBalanceValue = Math.abs(closingBalance);
  const grandTotalCredit = creditTotal + openingBalanceValue;
  const grandTotalDebit = debitTotal + closingBalanceValue;

  // Trailing summary rows in main table (aligned under Particulars, Credit, Debit, Status)
  const summaryRowsHTML = `
    <tr style="border-top: 2px solid #000; font-weight: bold;">
      <td colspan="4" style="border: 1px solid #000; padding: 5px 4px;"></td>
      <td style="border: 1px solid #000; padding: 5px 4px; text-align: right;">Total</td>
      <td class="col-credit" style="color: #059669;">${formatCurrency(creditTotal)}</td>
      <td class="col-debit" style="color: #dc2626;">${formatCurrency(debitTotal)}</td>
      <td class="col-status"></td>
    </tr>
    <tr style="font-weight: bold;">
      <td colspan="4" style="border: 1px solid #000; padding: 5px 4px;"></td>
      <td style="border: 1px solid #000; padding: 5px 4px; text-align: right;">Opening Balance</td>
      <td class="col-credit" style="color: #059669;">${formatCurrency(openingBalanceValue)}</td>
      <td class="col-debit">-</td>
      <td class="col-status"></td>
    </tr>
    <tr style="font-weight: bold;">
      <td colspan="4" style="border: 1px solid #000; padding: 5px 4px;"></td>
      <td style="border: 1px solid #000; padding: 5px 4px; text-align: right;">Closing Balance</td>
      <td class="col-credit">-</td>
      <td class="col-debit" style="color: #dc2626;">${formatCurrency(closingBalanceValue)}</td>
      <td class="col-status"></td>
    </tr>
    <tr style="background: #f3f4f6; font-weight: bold; border-bottom: 2px solid #000;">
      <td colspan="4" style="border: 1px solid #000; padding: 5px 4px;"></td>
      <td style="border: 1px solid #000; padding: 5px 4px; text-align: right;">Grand Total</td>
      <td class="col-credit" style="color: #059669;">${formatCurrency(grandTotalCredit)}</td>
      <td class="col-debit" style="color: #dc2626;">${formatCurrency(grandTotalDebit)}</td>
      <td class="col-status"></td>
    </tr>
  `;

  // Company-wise balances (only when provided)
  let companyTableHTML = '';
  if (companyBalances && companyBalances.length > 0) {
    const rows = companyBalances
      .map(company => {
        const openingAbs = Math.abs(company.openingBalance);
        const closingAbs = Math.abs(company.closingBalance);
        const isOpenDR = company.openingBalance < 0;
        const isCloseDR = company.closingBalance < 0;
        const openText = `${isOpenDR ? '-' : ''}${openingAbs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isOpenDR ? 'DR' : 'CR'}`;
        const closeText = `${isCloseDR ? '-' : ''}${closingAbs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ${isCloseDR ? 'DR' : 'CR'}`;
        return `
          <tr>
            <td style="border:1px solid #000;padding:4px 6px;font-weight:bold;">${company.companyName}</td>
            <td style="border:1px solid #000;padding:4px 6px;text-align:right;color:${isOpenDR ? '#dc2626' : '#059669'};">${openText}</td>
            <td style="border:1px solid #000;padding:4px 6px;text-align:right;color:${isCloseDR ? '#dc2626' : '#059669'};">${closeText}</td>
          </tr>
        `;
      })
      .join('');

    companyTableHTML = `
      <div class="company-balances-container" style="width: 100%; margin-top: 12px;">
        <table style="width:100%;border-collapse:collapse;font-size:12px;font-weight:bold;">
          <thead>
            <tr>
              <th colspan="3" style="border:1px solid #000;padding:5px 8px;background:#f3f4f6;text-align:center;">
                Company-wise Opening &amp; Closing Balances
              </th>
            </tr>
            <tr>
              <th style="border:1px solid #000;padding:5px 8px;background:#f3f4f6;text-align:left;">Company</th>
              <th style="border:1px solid #000;padding:5px 8px;background:#f3f4f6;text-align:right;">Opening Balance</th>
              <th style="border:1px solid #000;padding:5px 8px;background:#f3f4f6;text-align:right;">Closing Balance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // Subtitle rendering
  const subtitleHTML = subtitle
    ? subtitle.startsWith('Company:')
      ? `Company: <strong>${subtitle.replace('Company:', '').trim()}</strong>`
      : `<strong>${subtitle}</strong>`
    : '';

  const css = `
    @media print {
      @page {
        size: ${paperSize} ${orientation};
        margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
      }
      .no-print { display: none !important; }
      .company-balances-container { display: none !important; }
      body {
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .print-container {
        border: none !important;
        box-shadow: none !important;
        padding: 4px !important;
        margin: 0 !important;
      }
    }

    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.4;
      margin: 0;
      padding: 16px;
      background: #f5f5f5;
    }

    .print-container {
      background: white;
      padding: 16px;
      border: 2px solid #333;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }

    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }

    table.main-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 8px 0;
      font-size: 11px;
      font-weight: bold;
      table-layout: fixed;
    }

    .print-footer {
      text-align: center;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      margin-top: 16px;
      font-size: 11px;
      color: #666;
    }

    .no-print {
      text-align: center;
      margin: 12px 0;
    }

    .no-print button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 10px 28px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
    }

    .no-print button:hover {
      background: #1d4ed8;
    }

    ${getSharedPrintStyles({ isLandscape: orientation === 'landscape' })}
  `;

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title} - Thirumala Group</title>
  <meta charset="utf-8">
  <style>${css}</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">&#128424; Print</button>
  </div>
  <div class="print-container">
    ${includeHeader ? `
    <div class="print-header">
      <div style="flex:1;">
        <div style="font-size:17px;font-weight:bold;color:#333;">${title}</div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:20px;font-weight:bold;color:#333;">Thirumala Group</div>
        <div style="font-size:11px;color:#666;">Business Management System</div>
      </div>
      <div style="flex:1;text-align:right;">
        ${subtitleHTML ? `<div style="font-size:13px;font-weight:bold;">${subtitleHTML}</div>` : ''}
        <div style="font-size:10px;color:#666;">${headerText}</div>
      </div>
    </div>
    ` : ''}

    <table class="main-table">
      <thead>
        <tr>${tableHeaders}</tr>
      </thead>
      <tbody>
        ${tableRows}
        ${summaryRowsHTML}
      </tbody>
    </table>

    ${companyTableHTML}

    ${includeFooter ? `
    <div class="print-footer">
      <p>${footerText}</p>
    </div>
    ` : ''}
  </div>
</body>
</html>`;

  // Write to the single print window and trigger print on load
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};