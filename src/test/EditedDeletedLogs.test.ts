import { describe, it, expect } from 'vitest';
import {
  mapFieldLabel,
  formatDateHuman,
  formatLogValue,
  mapTableName,
  flattenLog,
} from '../pages/finance/EditedDeletedLogs';
import { FinanceEditedLog } from '../lib/supabaseFinance';

describe('EditedDeletedLogs UI Helper Functions', () => {
  describe('mapFieldLabel', () => {
    it('maps known database fields to human-friendly labels', () => {
      expect(mapFieldLabel('amount')).toBe('LOAN AMOUNT');
      expect(mapFieldLabel('interest_rate')).toBe('INTEREST RATE (%)');
      expect(mapFieldLabel('due_type')).toBe('DUE TYPE');
    });

    it('gracefully converts unknown snake_case fields to Title Case', () => {
      expect(mapFieldLabel('custom_field_name')).toBe('CUSTOM FIELD NAME');
      expect(mapFieldLabel('anotherField')).toBe('ANOTHER FIELD');
    });
  });

  describe('formatDateHuman', () => {
    it('returns "-" for empty or invalid dates', () => {
      expect(formatDateHuman('')).toBe('-');
      expect(formatDateHuman('not-a-date')).toBe('-');
    });

    it('formats a valid date string correctly', () => {
      const formatted = formatDateHuman('2026-06-11T10:21:00.000Z');
      // format: DD-MMM-YYYY HH:MM AM/PM
      expect(formatted).toMatch(/^\d{2}-[A-Za-z]{3}-\d{4} \d{2}:\d{2} (AM|PM)$/);
    });
  });

  describe('formatLogValue', () => {
    it('returns "-" for null or undefined values', () => {
      expect(formatLogValue('amount', null)).toBe('-');
      expect(formatLogValue('amount', undefined)).toBe('-');
    });

    it('formats boolean values as Yes/No', () => {
      expect(formatLogValue('npa_closed', true)).toBe('YES');
      expect(formatLogValue('npa_closed', false)).toBe('NO');
    });

    it('formats interest/penalty/rate fields as percentages', () => {
      expect(formatLogValue('interest_rate', 3.5)).toBe('3.5%');
      expect(formatLogValue('penalty_percent', '2.5')).toBe('2.5%');
    });

    it('formats amount and charge fields as Indian Rupee (INR) currency', () => {
      const formatted = formatLogValue('amount', 100000);
      expect(formatted).toContain('1,00,000');
      // Could be formatted with Rupee symbol or currency abbreviation depending on env, let's look for digits
      expect(formatted).toMatch(/1,00,000/);
    });

    it('leaves standard strings as-is', () => {
      expect(formatLogValue('notes', 'Payment delayed')).toBe('Payment delayed');
    });
  });

  describe('mapTableName', () => {
    it('maps database tables to friendly names', () => {
      expect(mapTableName('finance_loans')).toBe('LOANS');
      expect(mapTableName('finance_customers')).toBe('CUSTOMERS');
      expect(mapTableName('finance_loans_collateral')).toBe('COLLATERAL');
      expect(mapTableName('finance_guarantors')).toBe('GUARANTORS');
      expect(mapTableName('unknown_table')).toBe('UNKNOWN_TABLE');
    });
  });

  describe('flattenLog', () => {
    it('flattens structured single-field change format (new format)', () => {
      const logEntry: FinanceEditedLog = {
        id: 'log-1',
        table_name: 'finance_loans',
        record_id: 'loan-uuid-123',
        old_values: {
          loan_id: 'loan-uuid-123',
          loan_number: 'CD065',
          customer_name: 'TEST CUSTOMER',
          field_name: 'Loan Amount',
          value: 10000,
        },
        new_values: {
          loan_id: 'loan-uuid-123',
          loan_number: 'CD065',
          customer_name: 'TEST CUSTOMER',
          field_name: 'Loan Amount',
          value: 100000,
          source: 'Edit Loan',
        },
        edited_by: 'admin_user',
        edited_at: '2026-06-11T10:21:00Z',
      };

      const flattened = flattenLog(logEntry);
      expect(flattened).toHaveLength(1);
      expect(flattened[0]).toEqual({
        id: 'log-1-Loan Amount',
        logId: 'log-1',
        edited_at: '2026-06-11T10:21:00Z',
        edited_by: 'admin_user',
        table_name: 'finance_loans',
        record_id: 'loan-uuid-123',
        field: 'Loan Amount',
        oldValue: 10000,
        newValue: 100000,
        source: 'Edit Loan',
        loanNo: 'CD065',
        customer: 'TEST CUSTOMER',
        rawLog: logEntry,
      });
    });

    it('flattens generic multi-field change format (old format) and filters ignored keys', () => {
      const logEntry: FinanceEditedLog = {
        id: 'log-2',
        table_name: 'finance_loans',
        record_id: 'loan-uuid-123',
        old_values: {
          id: 'loan-uuid-123',
          amount: 10000,
          interest_rate: 3,
          updated_at: '2026-06-10T12:00:00Z',
        },
        new_values: {
          id: 'loan-uuid-123',
          amount: 15000,
          interest_rate: 2.5,
          updated_at: '2026-06-11T10:00:00Z',
        },
        edited_by: 'staff_user',
        edited_at: '2026-06-11T10:21:00Z',
      };

      const flattened = flattenLog(logEntry);
      // 'id' and 'updated_at' should be filtered out because they are in ignoredKeys
      expect(flattened).toHaveLength(2);

      const amountChange = flattened.find(f => f.field === 'amount');
      expect(amountChange).toBeDefined();
      expect(amountChange?.oldValue).toBe(10000);
      expect(amountChange?.newValue).toBe(15000);

      const rateChange = flattened.find(f => f.field === 'interest_rate');
      expect(rateChange).toBeDefined();
      expect(rateChange?.oldValue).toBe(3);
      expect(rateChange?.newValue).toBe(2.5);
    });
  });
});
