import { supabase } from './supabase';

// TypeScript Interfaces for Finance Mode
export interface FinancePartner {
  id: string;
  partner_id?: number;
  name: string;
  is_md?: boolean;
  phone: string | null;
  home_phone?: string | null;
  village?: string | null;
  md_name?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceLedgerSetting {
  code: string;
  rate: number;
  overdue: number;
  method: string;
  days_per_year: number;
  principal_rolls_on_renewal: boolean;
  updated_at?: string;
}

export interface FinanceCustomer {
  id: string;
  name: string;
  phone: string | null;
  phone2?: string | null;
  partner_name?: string | null;
  address: string | null;
  aadhaar: string | null;
  created_at: string;
  updated_at: string;
  customer_photo_url?: string | null;
  fingerprint_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_added?: boolean;
  customer_fingerprint_template?: string | null;
  customer_fingerprint_image_url?: string | null;
  customer_fingerprint_added?: boolean;
  surety_fingerprint_template?: string | null;
  surety_fingerprint_image_url?: string | null;
  surety_fingerprint_added?: boolean;
  father_husband_name?: string | null;
  
  // Redesign fields
  customer_id?: number;
  father_name?: string | null;
  village?: string | null;
  mandal?: string | null;
  district?: string | null;
  aadhaar_address?: string | null;
  aadhaar_village?: string | null;
  aadhaar_mandal?: string | null;
  aadhaar_district?: string | null;
  present_address?: string | null;
  present_village?: string | null;
  present_mandal?: string | null;
  present_district?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
}

export interface FinanceGuarantor {
  id: string;
  guarantor_id?: number;
  name: string;
  aadhaar: string | null;
  aadhaar_address?: string | null;
  present_address?: string | null;
  phone: string | null;
  phone_2?: string | null;
  father_name?: string | null;
  village?: string | null;
  mandal?: string | null;
  district?: string | null;
  permanent_address?: string | null;
  permanent_village?: string | null;
  permanent_mandal?: string | null;
  permanent_district?: string | null;
  current_address?: string | null;
  current_village?: string | null;
  current_mandal?: string | null;
  current_district?: string | null;
  photo_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_image_url?: string | null;
  fingerprint_added?: boolean;
  fingerprint_status?: string | null;
  fingerprint_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceLoan {
  id: string;
  loan_id: string;
  customer_id: string;
  date: string;
  amount: number;
  interest_rate: number;
  duration_months: number;
  due_type: 'Daily' | 'Weekly' | 'Monthly';
  due_amount: number;
  surety_name: string | null;
  surety_phone: string | null;
  surety_aadhaar: string | null;
  surety_aadhaar_address?: string | null;
  surety_present_address?: string | null;
  surety_relation?: string | null;
  remarks: string | null;
  status: 'Active' | 'Closed' | 'NPA_CLOSED';
  created_at: string;
  updated_at: string;
  customer_photo_url?: string | null;
  surety_photo_url?: string | null;
  fingerprint_url?: string | null;
  fingerprint_template?: string | null;
  fingerprint_added?: boolean;
  customer_fingerprint_template?: string | null;
  customer_fingerprint_image_url?: string | null;
  customer_fingerprint_added?: boolean;
  surety_fingerprint_template?: string | null;
  surety_fingerprint_image_url?: string | null;
  surety_fingerprint_added?: boolean;
  father_husband_name?: string | null;
  loan_category?: string;
  npa_closed?: boolean;
  document_charges?: number;
  penalty_percent?: number;
  guarantor_1_id?: string | null;
  guarantor_2_id?: string | null;
  period_days?: number | null;
}

export interface FinanceLoanDocument {
  id: string;
  loan_id: string;
  category: string;
  document_name: string;
  remarks: string | null;
  file_url: string | null;
  is_submitted: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  loan_id: string;
  date: string;
  amount: number;
  type: 'Collection' | 'Disbursement' | 'Interest Charge' | 'Other';
  collected_by: string | null;
  remarks: string | null;
  payment_mode?: string | null;
  receipt_no?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCapitalEntry {
  id: string;
  entry_date: string;
  partner_id: string;
  partner_name: string | null;
  particulars: string | null;
  credit: number;
  debit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceDue {
  id: string;
  loan_id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: 'Pending' | 'Paid' | 'Partially Paid';
  created_at: string;
  updated_at: string;
}

export interface FinancePhoto {
  id: string;
  loan_id: string;
  photo_type: 'Customer' | 'Surety';
  photo_url: string;
  created_at: string;
}

export interface FinanceDocument {
  id: string;
  loan_id: string;
  document_type: string;
  document_url: string;
  created_at: string;
}


export interface FinanceEditedLog {
  id: string;
  table_name: string;
  record_id: string;
  old_values: any;
  new_values: any;
  edited_by: string;
  edited_at: string;
}

export interface FinanceDeletedLog {
  id: string;
  table_name: string;
  record_id: string;
  old_values: any;
  deleted_by: string;
  deleted_at: string;
}

export interface FinanceCashbookAccount {
  id: string;
  account_name: string;
  account_number: string | null;
  created_at: string;
}

export interface FinanceCashbookEntry {
  id: string;
  entry_date: string;
  account_number: string | null;
  head_of_account: string;
  particulars: string;
  credit: number;
  debit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceNPARecord {
  id: string;
  loan_id: string | null;
  customer_id: string | null;
  customer_name: string;
  aadhaar: string | null;
  phone: string | null;
  loan_type: string | null;
  loan_amount: number;
  paid_amount: number;
  balance_amount: number;
  interest_due: number;
  penalty_due: number;
  settlement_amount: number;
  total_liability?: number;
  waived_amount?: number;
  reason: string | null;
  full_history_json: any;
  closed_by: string | null;
  closed_at: string;
  created_at: string;
}

export interface FinanceCDLedgerEntry {
  id: string;
  loan_id: string;
  customer_id: string | null;
  entry_date: string;
  account_name: string | null;
  credit: number;
  debit: number;
  receipt_no: string | null;
  particulars: string | null;
  user_name: string | null;
  entry_type: string | null;
  created_at: string;
}

export interface FinanceCDInterestDetail {
  id: string;
  loan_id: string;
  entry_id: string;
  entry_date: string;
  credit: number;
  receipt_no: string | null;
  particulars: string | null;
  renewed_days: number;
  renewed_till_date: string | null;
  row_type: string | null;
  created_at: string;
}

export interface FinanceNPARecord {
  id: string;
  loan_id: string | null;
  customer_id: string | null;
  customer_name: string;
  aadhaar: string | null;
  phone: string | null;
  loan_type: string | null;
  loan_amount: number;
  paid_amount: number;
  balance_amount: number;
  interest_due: number;
  penalty_due: number;
  settlement_amount: number;
  total_liability?: number;
  waived_amount?: number;
  reason: string | null;
  full_history_json: any | null;
  closed_by: string | null;
  closed_at: string;
  created_at: string;
}

export interface FinanceDocumentReturned {
  id: string;
  loan_id: string;
  returned_date: string;
  returned_to: string;
  received_by_signature: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
}

// --------------------------------------------------
// Settings & System Configuration Interfaces

class SupabaseFinance {
  // --- Partners ---
  async getPartners(): Promise<FinancePartner[]> {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance partners:', error);
      return [];
    }
  }

  async getPartnerBasics(): Promise<Partial<FinancePartner>[]> {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .select('id, partner_id, name, phone, is_md')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance partner basics:', error);
      return [];
    }
  }

  async createPartner(partner: Omit<FinancePartner, 'id' | 'created_at' | 'updated_at'>): Promise<FinancePartner | null> {
    try {
      const { data, error } = await supabase
        .from('finance_partners')
        .insert([partner])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance partner:', error);
      return null;
    }
  }

  async updatePartner(id: string, partner: Partial<FinancePartner>, editedBy: string): Promise<FinancePartner | null> {
    try {
      // Get old values for logging
      const { data: oldData } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_partners')
        .update({ ...partner, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData) {
        await this.logEdit('finance_partners', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance partner:', error);
      return null;
    }
  }

  async deletePartner(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_partners')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_partners')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_partners', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance partner:', error);
      return false;
    }
  }

  // --- Guarantors ---
  async getGuarantors(): Promise<FinanceGuarantor[]> {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance guarantors:', error);
      return [];
    }
  }

  async searchGuarantors(query: string): Promise<Partial<FinanceGuarantor>[]> {
    try {
      if (!query || query.length < 2) return [];
      
      const { data, error } = await supabase
        .from('finance_guarantors')
        .select('id, guarantor_id, name, aadhaar, phone, phone_2, permanent_address, permanent_village, permanent_mandal, permanent_district, current_address, current_village, current_mandal, current_district, village, mandal, district, aadhaar_address, present_address')
        .is('deleted_at', null)
        .or(`name.ilike.%${query}%,guarantor_id.eq.${!isNaN(Number(query)) ? Number(query) : 0},phone.ilike.%${query}%,aadhaar.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching finance guarantors:', error);
      return [];
    }
  }

  async getGuarantorById(id: string): Promise<FinanceGuarantor | null> {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching finance guarantor by id:', error);
      return null;
    }
  }

  async createGuarantor(guarantor: Omit<FinanceGuarantor, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceGuarantor | null> {
    try {
      const { data, error } = await supabase
        .from('finance_guarantors')
        .insert([guarantor])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance guarantor:', error);
      return null;
    }
  }

  async updateGuarantor(id: string, guarantor: Partial<FinanceGuarantor>, editedBy: string): Promise<FinanceGuarantor | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_guarantors')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_guarantors')
        .update({ ...guarantor, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData) {
        await this.logEdit('finance_guarantors', id, oldData, data, editedBy);
      }

      return data;
    } catch (error) {
      console.error('Error updating finance guarantor:', error);
      return null;
    }
  }

  async deleteGuarantor(id: string, deletedBy: string): Promise<boolean> {
    try {
      // Check for active loans
      const { count: loanCount1, error: error1 } = await supabase
        .from('finance_loans')
        .select('*', { count: 'exact', head: true })
        .eq('guarantor_1_id', id)
        .neq('status', 'Closed');
      const { count: loanCount2, error: error2 } = await supabase
        .from('finance_loans')
        .select('*', { count: 'exact', head: true })
        .eq('guarantor_2_id', id)
        .neq('status', 'Closed');

      if (error1 || error2) throw error1 || error2;
      
      if ((loanCount1 || 0) > 0 || (loanCount2 || 0) > 0) {
        return false;
      }

      const { data: oldData } = await supabase
        .from('finance_guarantors')
        .select('*')
        .eq('id', id)
        .single();

      // Soft delete
      const { error } = await supabase
        .from('finance_guarantors')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
        
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_guarantors', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance guarantor:', error);
      return false;
    }
  }

  async addTransaction(payload: Partial<FinanceTransaction>): Promise<FinanceTransaction> {
    const { data, error } = await supabase.from('finance_transactions').insert(payload).select().single();
    if (error) {
      console.error('Error adding finance transaction:', error);
      throw error;
    }
    return data;
  }

  async addCDLedgerEntry(payload: Partial<FinanceCDLedgerEntry>): Promise<FinanceCDLedgerEntry> {
    const totalPaidVal = Number(payload.credit || 0) + Number(payload.debit || 0);
    const fullPayload = {
      ...payload,
      date: payload.entry_date || (payload as any).date,
      entry_date: payload.entry_date || (payload as any).date,
      total_paid: (payload as any).total_paid !== undefined ? (payload as any).total_paid : totalPaidVal
    };
    const { data, error } = await supabase.from('finance_cd_ledger_entries').insert(fullPayload).select().single();
    if (error) {
      console.error('Error adding CD ledger entry:', error);
      throw error;
    }
    return data;
  }

  async addCDInterestDetail(payload: Partial<FinanceCDInterestDetail>): Promise<FinanceCDInterestDetail> {
    const fullPayload: any = {
      ...payload,
      entry_date: payload.entry_date || (payload as any).date
    };
    if ('date' in fullPayload) {
      delete fullPayload.date;
    }
    const { data, error } = await supabase.from('finance_cd_interest_details').insert(fullPayload).select().single();
    if (error) {
      console.error('Error adding CD interest detail:', error);
      throw error;
    }
    return data;
  }

  async getNextReceiptNumber(): Promise<string> {
    try {
      let maxNum = 0;

      const extractMax = (rows: Array<{ receipt_no?: string | null }>) => {
        if (!rows) return;
        for (const row of rows) {
          if (row.receipt_no) {
            const match = row.receipt_no.match(/RC(\d+)/i);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNum) maxNum = num;
            }
          }
        }
      };

      // Query finance_cd_ledger_entries
      const { data: ledgerData } = await supabase
        .from('finance_cd_ledger_entries')
        .select('receipt_no')
        .like('receipt_no', 'RC%');
      extractMax(ledgerData || []);

      // Query finance_cd_interest_details
      const { data: interestData } = await supabase
        .from('finance_cd_interest_details')
        .select('receipt_no')
        .like('receipt_no', 'RC%');
      extractMax(interestData || []);

      // Query finance_transactions (safe - column may not exist in all envs)
      try {
        const { data: txData } = await supabase
          .from('finance_transactions')
          .select('receipt_no')
          .like('receipt_no', 'RC%');
        extractMax(txData || []);
      } catch (_) {
        // Ignore if receipt_no column does not exist yet
      }

      // Query finance_documents_returned
      try {
        const { data: docRetData } = await supabase
          .from('finance_documents_returned')
          .select('receipt_no')
          .like('receipt_no', 'RC%');
        extractMax(docRetData || []);
      } catch (_) {
        // Ignore if receipt_no column does not exist yet
      }

      const nextNum = maxNum + 1;
      const padded = String(nextNum).padStart(3, '0');
      return `RC${padded}`;
    } catch (e) {
      console.error('Error generating receipt number:', e);
      return 'RC001';
    }
  }

  async generateUniqueReceiptNo(): Promise<string> {
    return this.getNextReceiptNumber();
  }

  async postCdLedgerPayment(params: {
    loanId: string;
    customerId: string;
    accountName: string | null;
    userName: string;
    actionType: 'Renew' | 'Partial' | 'Close';
    principalPaid: number;
    interestPaid: number;
    penaltyPaid: number;
    renewedDays: number;
    paymentDate?: string;
    receiptNo?: string;
    renewedTillDate?: string | null;
  }): Promise<{ success: boolean; error?: string; receiptNo?: string }> {
    try {
      const receiptNo = params.receiptNo || await this.generateUniqueReceiptNo();
      const entryDate = params.paymentDate ? new Date(params.paymentDate).toISOString() : new Date().toISOString();
      const totalAmount = params.principalPaid + params.interestPaid + params.penaltyPaid;

      // Build remarks
      let remarks = '';
      if (params.actionType === 'Renew') {
        if (params.interestPaid === 0 && params.penaltyPaid === 0) {
          remarks = `Renewal Payment / Principal Adjusted - ${receiptNo}`;
        } else {
          let parts = ['Renewal Payment'];
          let adjusted: string[] = [];
          if (params.penaltyPaid > 0) adjusted.push('Penalty Paid');
          if (params.interestPaid > 0) adjusted.push('Interest Paid');
          if (params.principalPaid > 0) adjusted.push('Principal Adjusted');
          parts.push(adjusted.join(' & '));
          remarks = `${parts.join(' / ')} - ${receiptNo}`;
        }
      } else {
        const actionText = params.actionType === 'Partial' ? 'Partial Payment' : 'Close Account';
        let parts = [actionText];
        let adjusted: string[] = [];
        if (params.penaltyPaid > 0) adjusted.push('Penalty Paid');
        if (params.interestPaid > 0) adjusted.push('Interest Paid');
        if (params.principalPaid > 0) adjusted.push('Principal Paid');
        if (adjusted.length > 0) {
          parts.push(adjusted.join(' & '));
        } else {
          parts.push('Principal Adjusted');
        }
        remarks = `${parts.join(' / ')} - ${receiptNo}`;
      }

      // 1. Post to finance_transactions (Daybook)
      await this.addTransaction({
        loan_id: params.loanId,
        type: 'Collection',
        amount: totalAmount,
        date: entryDate,
        remarks: remarks,
        collected_by: params.userName,
        receipt_no: receiptNo
      });

      let mainEntryId: string | null = null;
      const actionText = params.actionType === 'Renew'
        ? 'Renewal Completed'
        : (params.actionType === 'Partial' ? 'Partial Payment' : 'Close');

      const isInterestOrPenaltyPaid = params.interestPaid > 0 || params.penaltyPaid > 0;

      // 2. Post Penalty
      if (params.penaltyPaid > 0) {
        const penaltyParticulars = params.actionType === 'Renew'
          ? 'Penalty Paid - Renewal Payment'
          : `Penalty Paid - ${actionText} - ${receiptNo}`;

        const entry = await this.addCDLedgerEntry({
          loan_id: params.loanId,
          customer_id: params.customerId,
          account_name: 'PENALTY A/C',
          entry_date: entryDate,
          credit: params.penaltyPaid,
          debit: 0,
          receipt_no: receiptNo,
          particulars: penaltyParticulars,
          user_name: params.userName,
          entry_type: 'penalty_payment'
        });

        if (entry) {
          mainEntryId = entry.id;
          if (isInterestOrPenaltyPaid) {
            await this.addCDInterestDetail({
              loan_id: params.loanId,
              entry_id: entry.id,
              entry_date: entryDate,
              credit: params.penaltyPaid,
              receipt_no: receiptNo,
              particulars: penaltyParticulars,
              renewed_days: 0,
              renewed_till_date: null,
              row_type: entry.entry_type
            });
          }
        }
      }

      // 3. Post Interest
      if (params.interestPaid > 0) {
        const interestParticulars = params.actionType === 'Renew'
          ? 'Interest Paid - Renewal Payment'
          : `Interest Paid - ${actionText} - ${receiptNo}`;

        const entry = await this.addCDLedgerEntry({
          loan_id: params.loanId,
          customer_id: params.customerId,
          account_name: 'CD COMMISSION A/C',
          entry_date: entryDate,
          credit: params.interestPaid,
          debit: 0,
          receipt_no: receiptNo,
          particulars: interestParticulars,
          user_name: params.userName,
          entry_type: 'interest_payment'
        });

        if (entry) {
          if (!mainEntryId) mainEntryId = entry.id;
          if (isInterestOrPenaltyPaid) {
            const renewedTillDate = params.renewedTillDate !== undefined
              ? params.renewedTillDate
              : (params.renewedDays > 0 
                  ? (() => {
                      const dateObj = new Date(new Date(entryDate).getTime() + params.renewedDays * 24 * 60 * 60 * 1000);
                      const tzoffset = dateObj.getTimezoneOffset() * 60000;
                      return new Date(dateObj.getTime() - tzoffset).toISOString().split('T')[0];
                    })()
                  : null);

            await this.addCDInterestDetail({
              loan_id: params.loanId,
              entry_id: entry.id,
              entry_date: entryDate,
              credit: params.interestPaid,
              receipt_no: receiptNo,
              particulars: interestParticulars,
              renewed_days: params.renewedDays,
              renewed_till_date: renewedTillDate,
              row_type: entry.entry_type
            });
          }
        }
      }

      // 4. Post Principal
      if (params.principalPaid > 0) {
        const principalParticulars = params.actionType === 'Renew'
          ? 'Principal Adjusted - Renewal Payment'
          : `Principal Adjusted - ${actionText} - ${receiptNo}`;

        const entry = await this.addCDLedgerEntry({
          loan_id: params.loanId,
          customer_id: params.customerId,
          account_name: 'CD A/C',
          entry_date: entryDate,
          credit: params.principalPaid,
          debit: 0,
          receipt_no: receiptNo,
          particulars: principalParticulars,
          user_name: params.userName,
          entry_type: 'principal_payment'
        });

        if (entry) {
          if (!mainEntryId) mainEntryId = entry.id;
          if (isInterestOrPenaltyPaid) {
            await this.addCDInterestDetail({
              loan_id: params.loanId,
              entry_id: entry.id,
              entry_date: entryDate,
              credit: params.principalPaid,
              receipt_no: receiptNo,
              particulars: principalParticulars,
              renewed_days: 0,
              renewed_till_date: null,
              row_type: entry.entry_type
            });
          }
        }
      }

      // 5. Post Note row to Interest Details (Credit = 0, contains full split detail description)
      if (mainEntryId && isInterestOrPenaltyPaid) {
        const renewedTillDate = params.renewedDays > 0 
          ? new Date(new Date(entryDate).getTime() + params.renewedDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null;

        const noteParticulars = params.actionType === 'Renew'
          ? `Renewal Completed Note: Total Paid ₹${totalAmount} (Penalty: ₹${params.penaltyPaid}, Interest: ₹${params.interestPaid}, Principal: ₹${params.principalPaid})`
          : `${params.actionType} Note: Total Paid ₹${totalAmount} (Penalty: ₹${params.penaltyPaid}, Interest: ₹${params.interestPaid}, Principal: ₹${params.principalPaid})`;

        await this.addCDInterestDetail({
          loan_id: params.loanId,
          entry_id: mainEntryId,
          entry_date: entryDate,
          credit: 0,
          receipt_no: receiptNo,
          particulars: noteParticulars,
          renewed_days: params.renewedDays,
          renewed_till_date: renewedTillDate,
          row_type: params.actionType === 'Renew' ? 'Renewal' : 'Partial Payment'
        });
      }

      return { success: true, receiptNo };
    } catch (e: any) {
      console.error('Error posting CD ledger payment:', e);
      return { success: false, error: e?.message || String(e) };
    }
  }

  async getCDLedgerEntries(loanId: string): Promise<FinanceCDLedgerEntry[]> {
    try {
      const [{ data: nativeEntries, error: nativeError }, { data: legacyTransactions, error: legacyError }, { data: loanData }] = await Promise.all([
        supabase.from('finance_cd_ledger_entries').select('*').eq('loan_id', loanId).order('created_at', { ascending: true }),
        supabase.from('finance_transactions').select('*').eq('loan_id', loanId).order('date', { ascending: true }),
        supabase.from('finance_loans').select('*').eq('id', loanId).single()
      ]);

      if (nativeError) throw nativeError;
      if (legacyError) throw legacyError;

      const entries: FinanceCDLedgerEntry[] = nativeEntries || [];
      const legacy: any[] = legacyTransactions || [];

      const existingReceipts = new Set(entries.map(e => e.receipt_no).filter(Boolean));
      const mappedEntries: FinanceCDLedgerEntry[] = [];

      // Check if there's any disbursement transaction. If not, map from loan.
      // Also skip if a native original_loan entry already exists in finance_cd_ledger_entries (new loan flow).
      const hasNativeOriginalLoan = entries.some(e => e.entry_type === 'original_loan');
      const hasDisbursement = legacy.some(tx => tx.type === 'Disbursement');
      if (!hasDisbursement && !hasNativeOriginalLoan && loanData) {
         mappedEntries.push({
            id: `legacy-loan-${loanData.id}`,
            loan_id: loanData.id,
            customer_id: loanData.customer_id,
            account_name: 'CD A/C',
            entry_date: loanData.date,
            credit: 0,
            debit: Number(loanData.amount),
            receipt_no: null,
            particulars: 'Original Loan Disbursement',
            user_name: 'System',
            entry_type: 'original_loan',
            created_at: loanData.created_at || loanData.date
         });
      }

      for (const tx of legacy) {
        const remarks = tx.remarks || '';
        const match = remarks.match(/(REC-\d+|RC\d+)/i);
        const receiptNoFromRemarks = match ? match[0] : null;
        const txReceiptNo = tx.receipt_no || receiptNoFromRemarks;

        if (txReceiptNo && existingReceipts.has(txReceiptNo)) {
          continue;
        }

        if (tx.type === 'Disbursement') {
          // Skip if a native original_loan entry already exists — avoids duplicate disbursement rows
          if (hasNativeOriginalLoan) continue;
          mappedEntries.push({
            id: `legacy-${tx.id}`,
            loan_id: tx.loan_id,
            customer_id: '',
            account_name: 'CD A/C',
            entry_date: tx.date,
            credit: 0,
            debit: Number(tx.amount),
            receipt_no: null,
            particulars: 'Original Loan Disbursement',
            user_name: tx.collected_by || 'System',
            entry_type: 'original_loan',
            created_at: tx.created_at || tx.date
          });
        } else if (tx.type === 'Collection') {
          // If a native entry already matched this amount on this date, assume it's the same and skip
          // Note: a single collection tx might be split into native Penalty + native Interest rows, so sum them per receipt
          const txTime = new Date(tx.date).getTime();
          const exactDateNativeSum = entries
            .filter(e => new Date(e.entry_date).getTime() === txTime)
            .reduce((sum, e) => sum + Number(e.credit || 0), 0);

          const hasExactMatch = entries.some(e => new Date(e.entry_date).getTime() === txTime && Number(e.credit) === Number(tx.amount) && !e.receipt_no) ||
                                (exactDateNativeSum > 0 && Math.abs(exactDateNativeSum - Number(tx.amount)) < 0.01);

          if (!hasExactMatch) {
            mappedEntries.push({
              id: `legacy-${tx.id}`,
              loan_id: tx.loan_id,
              customer_id: '',
              account_name: null,
              entry_date: tx.date,
              credit: Number(tx.amount),
              debit: 0,
              receipt_no: txReceiptNo,
              particulars: tx.remarks || 'Legacy Payment',
              user_name: tx.collected_by || 'System',
              entry_type: 'Legacy Payment',
              created_at: tx.created_at || tx.date
            });
          }
        }
      }

      const finalEntries = [...entries, ...mappedEntries].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
      return finalEntries;
    } catch (err) {
      console.error('Error fetching CD ledger entries:', err);
      return [];
    }
  }

  async getCDInterestDetails(loanId: string): Promise<FinanceCDInterestDetail[]> {
    try {
      const { data, error } = await supabase.from('finance_cd_interest_details').select('*').eq('loan_id', loanId).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching CD interest details:', err);
      return [];
    }
  }

  async addNPARecord(payload: Partial<FinanceNPARecord>): Promise<FinanceNPARecord | null> {
    try {
      const { data, error } = await supabase.from('finance_npa_records').insert(payload).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding NPA record:', err);
      return null;
    }
  }

  async checkNPARecord(aadhaar: string): Promise<FinanceNPARecord | null> {
    try {
      if (!aadhaar) return null;
      const { data, error } = await supabase.from('finance_npa_records').select('*').eq('aadhaar', aadhaar).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error checking NPA record:', err);
      return null;
    }
  }

  async checkNPARecordByCustomer(customerId: string): Promise<FinanceNPARecord | null> {
    try {
      if (!customerId) return null;
      const { data, error } = await supabase.from('finance_npa_records').select('*').eq('customer_id', customerId).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error checking NPA record by customer ID:', err);
      return null;
    }
  }

  async addDocumentReturned(payload: Partial<FinanceDocumentReturned>): Promise<FinanceDocumentReturned | null> {
    try {
      const { data, error } = await supabase.from('finance_documents_returned').insert(payload).select().single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error adding document returned record:', err);
      return null;
    }
  }

  // --- Customers ---
  async getCustomers(): Promise<FinanceCustomer[]> {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance customers:', error);
      return [];
    }
  }

  async searchCustomers(query: string): Promise<Partial<FinanceCustomer>[]> {
    try {
      if (!query || query.length < 2) return [];

      const { data, error } = await supabase
        .from('finance_customers')
        .select('id, customer_id, name, aadhaar, phone_1, phone_2, phone, father_name, father_husband_name, present_address, address, partner_name')
        .or(`name.ilike.%${query}%,customer_id.eq.${!isNaN(Number(query)) ? Number(query) : 0},phone.ilike.%${query}%,phone_1.ilike.%${query}%,phone_2.ilike.%${query}%,aadhaar.ilike.%${query}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching finance customers:', error);
      return [];
    }
  }

  async getCustomerById(id: string): Promise<FinanceCustomer | null> {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching finance customer by id:', error);
      return null;
    }
  }

  async createCustomer(customer: Omit<FinanceCustomer, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCustomer | null> {
    try {
      const { data, error } = await supabase
        .from('finance_customers')
        .insert([customer])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, customer: Partial<FinanceCustomer>, editedBy: string, skipLogging?: boolean): Promise<FinanceCustomer | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_customers')
        .update({ ...customer, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Sync to finance_fingerprints
      if (customer.customer_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('customer_id', id)
          .eq('fingerprint_type', 'Customer');
        if (customer.customer_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: id,
              fingerprint_type: 'Customer',
              fingerprint_template: customer.customer_fingerprint_template,
              fingerprint_image_url: customer.customer_fingerprint_image_url
            }]);
        }
      }
      if (customer.surety_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('customer_id', id)
          .eq('fingerprint_type', 'Surety');
        if (customer.surety_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: id,
              fingerprint_type: 'Surety',
              fingerprint_template: customer.surety_fingerprint_template,
              fingerprint_image_url: customer.surety_fingerprint_image_url
            }]);
        }
      }

      if (oldData && !skipLogging) {
        await this.logEdit('finance_customers', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance customer:', error);
      return null;
    }
  }

  async deleteCustomer(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_customers')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_customers')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_customers', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance customer:', error);
      return false;
    }
  }

  // --- Loans ---
  async getLoans(): Promise<(FinanceLoan & { customer: FinanceCustomer })[]> {
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers!customer_id(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance loans:', error);
      return [];
    }
  }

  async getRecentLoans(limit: number = 5): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select('id, loan_id, loan_category, due_type, amount, created_at, customer:finance_customers!customer_id(name)')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent finance loans:', error);
      return [];
    }
  }

  async getCDLoansList(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('finance_loans')
        .select(`
          id, loan_id, amount, date, status, npa_closed, loan_category, interest_rate, penalty_percent, duration_months,
          customer:finance_customers!customer_id(*),
          guarantor_1:finance_customers!guarantor_1_id(*),
          guarantor_2:finance_customers!guarantor_2_id(*)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching CD loans list:', error);
      return [];
    }
  }

  async getLoanById(id: string): Promise<(FinanceLoan & { customer: FinanceCustomer; transactions: FinanceTransaction[]; photos: FinancePhoto[]; dues: FinanceDue[]; documents: FinanceDocument[] }) | null> {
    try {
      const { data: loan, error: loanError } = await supabase
        .from('finance_loans')
        .select('*, customer:finance_customers!customer_id(*)')
        .eq('id', id)
        .single();
      if (loanError) throw loanError;
      if (!loan) return null;

      const { data: transactions } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('loan_id', id)
        .order('date', { ascending: true });

      const { data: photos } = await supabase
        .from('finance_photos')
        .select('*')
        .eq('loan_id', id);

      const { data: dues } = await supabase
        .from('finance_dues')
        .select('*')
        .eq('loan_id', id)
        .order('due_date', { ascending: true });

      let documents: FinanceDocument[] = [];
      try {
        const { data: docs, error: docsError } = await supabase
          .from('finance_documents')
          .select('*')
          .eq('loan_id', id)
          .order('created_at', { ascending: false });
        if (!docsError && docs) {
          documents = docs;
        }
      } catch (docErr) {
        console.warn('Could not fetch finance_documents (table might not exist yet):', docErr);
      }

      return {
        ...loan,
        transactions: transactions || [],
        photos: photos || [],
        dues: dues || [],
        documents
      };
    } catch (error) {
      console.error('Error fetching loan by id:', error);
      return null;
    }
  }

  async createLoan(
    loanData: Omit<FinanceLoan, 'id' | 'created_at' | 'updated_at' | 'status'>,
    customerData: { 
      id?: string; 
      name?: string; 
      phone?: string | null; 
      address?: string | null; 
      aadhaar?: string | null;
      customer_photo_url?: string | null;
      fingerprint_url?: string | null;
      fingerprint_template?: string | null;
      fingerprint_added?: boolean;
      customer_fingerprint_template?: string | null;
      customer_fingerprint_image_url?: string | null;
      customer_fingerprint_added?: boolean;
      surety_fingerprint_template?: string | null;
      surety_fingerprint_image_url?: string | null;
      surety_fingerprint_added?: boolean;
      father_husband_name?: string | null;
    },
    duesData: Omit<FinanceDue, 'id' | 'loan_id' | 'paid_amount' | 'status' | 'created_at' | 'updated_at'>[],
    photosData: { photo_type: 'Customer' | 'Surety'; photo_url: string }[],
    documentsData: Omit<FinanceLoanDocument, 'id' | 'loan_id' | 'created_at' | 'updated_at'>[] | undefined,
    staffName: string
  ): Promise<FinanceLoan | null> {
    try {
      let customerId = customerData.id;

      // Create customer if they don't exist
      if (!customerId) {
        const { data: customer, error: customerError } = await supabase
          .from('finance_customers')
          .insert([{
            name: customerData.name || '',
            phone: customerData.phone || '',
            address: customerData.address || '',
            aadhaar: customerData.aadhaar || null,
            customer_photo_url: customerData.customer_photo_url || null,
            fingerprint_url: customerData.fingerprint_url || null,
            fingerprint_template: customerData.fingerprint_template || null,
            fingerprint_added: customerData.fingerprint_added || false,
            customer_fingerprint_template: customerData.customer_fingerprint_template || null,
            customer_fingerprint_image_url: customerData.customer_fingerprint_image_url || null,
            customer_fingerprint_added: customerData.customer_fingerprint_added || false,
            surety_fingerprint_template: customerData.surety_fingerprint_template || null,
            surety_fingerprint_image_url: customerData.surety_fingerprint_image_url || null,
            surety_fingerprint_added: customerData.surety_fingerprint_added || false,
            father_husband_name: customerData.father_husband_name || null
          }])
          .select()
          .single();

        if (customerError) throw customerError;
        customerId = customer.id;
      } else {
        // If existing customer, update customer's photo/fingerprint if provided
        if (
          customerData.customer_photo_url || 
          customerData.fingerprint_url || 
          customerData.customer_fingerprint_template || 
          customerData.surety_fingerprint_template ||
          customerData.father_husband_name
        ) {
          const updatePayload: Partial<FinanceCustomer> = {};
          if (customerData.customer_photo_url) updatePayload.customer_photo_url = customerData.customer_photo_url;
          if (customerData.father_husband_name) updatePayload.father_husband_name = customerData.father_husband_name;
          if (customerData.fingerprint_url) {
            updatePayload.fingerprint_url = customerData.fingerprint_url;
            updatePayload.fingerprint_template = customerData.fingerprint_template;
            updatePayload.fingerprint_added = customerData.fingerprint_added;
          }
          if (customerData.customer_fingerprint_template) {
            updatePayload.customer_fingerprint_template = customerData.customer_fingerprint_template;
            updatePayload.customer_fingerprint_image_url = customerData.customer_fingerprint_image_url;
            updatePayload.customer_fingerprint_added = customerData.customer_fingerprint_added;
          }
          if (customerData.surety_fingerprint_template) {
            updatePayload.surety_fingerprint_template = customerData.surety_fingerprint_template;
            updatePayload.surety_fingerprint_image_url = customerData.surety_fingerprint_image_url;
            updatePayload.surety_fingerprint_added = customerData.surety_fingerprint_added;
          }
          await this.updateCustomer(customerId, updatePayload, staffName);
        }
      }

      // Create loan record
      const safeLoanData = { ...loanData };
      delete (safeLoanData as any).customer_fingerprint_template;
      delete (safeLoanData as any).customer_fingerprint_image_url;
      delete (safeLoanData as any).customer_fingerprint_added;
      delete (safeLoanData as any).surety_fingerprint_template;
      delete (safeLoanData as any).surety_fingerprint_image_url;
      delete (safeLoanData as any).surety_fingerprint_added;

      const { data: loan, error: loanError } = await supabase
        .from('finance_loans')
        .insert([{
          ...safeLoanData,
          customer_id: customerId,
          status: 'Active',
          customer_photo_url: loanData.customer_photo_url || customerData.customer_photo_url || null,
          surety_photo_url: loanData.surety_photo_url || null,
          fingerprint_url: loanData.fingerprint_url || customerData.fingerprint_url || null,
          fingerprint_template: loanData.fingerprint_template || customerData.fingerprint_template || null,
          fingerprint_added: loanData.fingerprint_added || customerData.fingerprint_added || false,
          father_husband_name: loanData.father_husband_name || customerData.father_husband_name || null,
          loan_category: loanData.loan_category || 'Regular'
        }])
        .select()
        .single();

      if (loanError) throw loanError;

      // Create disbursement transaction
      const { error: txError } = await supabase
        .from('finance_transactions')
        .insert([{
          loan_id: loan.id,
          date: loan.date,
          amount: loan.amount,
          type: 'Disbursement',
          collected_by: staffName,
          remarks: 'Loan disbursed'
        }]);

      if (txError) throw txError;

      // --- Write immutable CD ledger opening rows ---
      // These rows are fixed at disbursement time and must NEVER be updated or recalculated.

      // 1. Original Loan Disbursement (debit row)
      await supabase.from('finance_cd_ledger_entries').insert([{
        loan_id: loan.id,
        customer_id: customerId,
        account_name: 'CD A/C',
        entry_date: loan.date,
        credit: 0,
        debit: Number(loan.amount),
        receipt_no: '-',
        particulars: 'Original Loan Disbursement',
        user_name: staffName,
        entry_type: 'original_loan'
      }]);

      // 2. Opening CD Commission (fixed at disbursement; never recalculated)
      const _commRate = Number(loan.interest_rate) || 3;
      const pDays = (loan.period_days && Number(loan.period_days) > 0) ? Number(loan.period_days) : 30;
      const _commAmount = Number(((Number(loan.amount) * (_commRate / 100) * pDays) / 30).toFixed(2));
      if (_commAmount > 0) {
        await supabase.from('finance_cd_ledger_entries').insert([{
          loan_id: loan.id,
          customer_id: customerId,
          account_name: 'CD COMMISSION A/C',
          entry_date: loan.date,
          credit: _commAmount,
          debit: 0,
          receipt_no: '-',
          particulars: 'Opening CD Commission Charged',
          user_name: staffName,
          entry_type: 'opening_commission'
        }]);
      }

      // 3. Document Charges (fixed at disbursement; never recalculated)
      const _docCharges = Number(loan.document_charges) || 0;
      if (_docCharges > 0) {
        await supabase.from('finance_cd_ledger_entries').insert([{
          loan_id: loan.id,
          customer_id: customerId,
          account_name: 'CD DOCUMENT CHARGES A/C',
          entry_date: loan.date,
          credit: _docCharges,
          debit: 0,
          receipt_no: '-',
          particulars: 'Document Charges Collected',
          user_name: staffName,
          entry_type: 'document_charge'
        }]);
      }
      // --- End of opening rows ---

      // Create dues schedule
      if (duesData && duesData.length > 0) {
        const formattedDues = duesData.map(due => ({
          loan_id: loan.id,
          due_date: due.due_date,
          amount: due.amount,
          paid_amount: 0,
          status: 'Pending'
        }));

        const { error: duesError } = await supabase
          .from('finance_dues')
          .insert(formattedDues);

        if (duesError) throw duesError;
      }

      // Save photos
      if (photosData && photosData.length > 0) {
        const formattedPhotos = photosData.map(photo => ({
          loan_id: loan.id,
          photo_type: photo.photo_type,
          photo_url: photo.photo_url
        }));

        const { error: photosError } = await supabase
          .from('finance_photos')
          .insert(formattedPhotos);

        if (photosError) throw photosError;
      }

      // Save documents
      if (documentsData && documentsData.length > 0) {
        const formattedDocs = documentsData.map(doc => ({
          ...doc,
          loan_id: loan.id
        }));

        const { error: docsError } = await supabase
          .from('finance_loan_documents')
          .insert(formattedDocs);

        if (docsError) throw docsError;
      }

      // Save fingerprints to finance_fingerprints table
      if (loanData.customer_fingerprint_template || customerData.customer_fingerprint_template) {
        await supabase
          .from('finance_fingerprints')
          .insert([{
            customer_id: customerId,
            loan_id: loan.id,
            fingerprint_type: 'Customer',
            fingerprint_template: loanData.customer_fingerprint_template || customerData.customer_fingerprint_template,
            fingerprint_image_url: loanData.customer_fingerprint_image_url || customerData.customer_fingerprint_image_url
          }]);
      }
      if (loanData.surety_fingerprint_template || customerData.surety_fingerprint_template) {
        await supabase
          .from('finance_fingerprints')
          .insert([{
            customer_id: customerId,
            loan_id: loan.id,
            fingerprint_type: 'Surety',
            fingerprint_template: loanData.surety_fingerprint_template || customerData.surety_fingerprint_template,
            fingerprint_image_url: loanData.surety_fingerprint_image_url || customerData.surety_fingerprint_image_url
          }]);
      }

      return loan;
    } catch (error) {
      console.error('Error creating finance loan:', error);
      throw error;
    }
  }

  async updateLoan(id: string, loan: Partial<FinanceLoan>, editedBy: string, skipLogging?: boolean): Promise<FinanceLoan | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('id', id)
        .single();

      const safeLoanUpdate = { ...loan };
      delete (safeLoanUpdate as any).customer_fingerprint_template;
      delete (safeLoanUpdate as any).customer_fingerprint_image_url;
      delete (safeLoanUpdate as any).customer_fingerprint_added;
      delete (safeLoanUpdate as any).surety_fingerprint_template;
      delete (safeLoanUpdate as any).surety_fingerprint_image_url;
      delete (safeLoanUpdate as any).surety_fingerprint_added;

      const { data, error } = await supabase
        .from('finance_loans')
        .update({ ...safeLoanUpdate, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Sync to finance_fingerprints
      if (loan.customer_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('loan_id', id)
          .eq('fingerprint_type', 'Customer');
        if (loan.customer_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: oldData?.customer_id,
              loan_id: id,
              fingerprint_type: 'Customer',
              fingerprint_template: loan.customer_fingerprint_template,
              fingerprint_image_url: loan.customer_fingerprint_image_url
            }]);
        }
      }
      if (loan.surety_fingerprint_template !== undefined) {
        await supabase
          .from('finance_fingerprints')
          .delete()
          .eq('loan_id', id)
          .eq('fingerprint_type', 'Surety');
        if (loan.surety_fingerprint_template) {
          await supabase
            .from('finance_fingerprints')
            .insert([{
              customer_id: oldData?.customer_id,
              loan_id: id,
              fingerprint_type: 'Surety',
              fingerprint_template: loan.surety_fingerprint_template,
              fingerprint_image_url: loan.surety_fingerprint_image_url
            }]);
        }
      }

      // Determine if there has been any financial activity on this loan.
      const [{ data: dbEntries }, { data: dbTransactions }, { data: dbInterests }] = await Promise.all([
        supabase.from('finance_cd_ledger_entries').select('id, entry_type').eq('loan_id', id),
        supabase.from('finance_transactions').select('id, type').eq('loan_id', id),
        supabase.from('finance_cd_interest_details').select('id').eq('loan_id', id)
      ]);

      const hasActivity =
        (dbTransactions || []).some((t: any) => t.type !== 'Disbursement') ||
        (dbInterests || []).length > 0 ||
        (dbEntries || []).some((e: any) =>
          e.entry_type !== 'original_loan' &&
          e.entry_type !== 'opening_commission' &&
          e.entry_type !== 'document_charge'
        );

      if (!hasActivity) {
        // 1. Sync Disbursement transaction in finance_transactions
        await supabase
          .from('finance_transactions')
          .update({
            amount: Number(data.amount),
            date: data.date
          })
          .eq('loan_id', id)
          .eq('type', 'Disbursement');

        // 2. Sync native finance_cd_ledger_entries (for CD loans)
        if (data.loan_category === 'CD') {
          const commRate = Number(data.interest_rate) || 3;
          const pDays = (data.period_days && Number(data.period_days) > 0) ? Number(data.period_days) : 30;
          const commAmount = Number(((Number(data.amount) * (commRate / 100) * pDays) / 30).toFixed(2));
          const docCharges = Number(data.document_charges) || 0;

          const existingEntries = dbEntries || [];

          // original_loan entry
          const origEntry = existingEntries.find((e: any) => e.entry_type === 'original_loan');
          if (origEntry) {
            await supabase
              .from('finance_cd_ledger_entries')
              .update({
                debit: Number(data.amount),
                date: data.date,
                entry_date: data.date
              })
              .eq('id', origEntry.id);
          } else {
            await supabase.from('finance_cd_ledger_entries').insert([{
              loan_id: id,
              customer_id: data.customer_id,
              account_name: 'CD A/C',
              date: data.date,
              entry_date: data.date,
              credit: 0,
              debit: Number(data.amount),
              receipt_no: '-',
              particulars: 'Original Loan Disbursement',
              user_name: editedBy,
              entry_type: 'original_loan',
              total_paid: 0
            }]);
          }

          // opening_commission entry
          const commEntry = existingEntries.find((e: any) => e.entry_type === 'opening_commission');
          if (commEntry) {
            if (commAmount > 0) {
              await supabase
                .from('finance_cd_ledger_entries')
                .update({
                  credit: commAmount,
                  date: data.date,
                  entry_date: data.date
                })
                .eq('id', commEntry.id);
            } else {
              await supabase
                .from('finance_cd_ledger_entries')
                .delete()
                .eq('id', commEntry.id);
            }
          } else if (commAmount > 0) {
            await supabase.from('finance_cd_ledger_entries').insert([{
              loan_id: id,
              customer_id: data.customer_id,
              account_name: 'CD COMMISSION A/C',
              date: data.date,
              entry_date: data.date,
              credit: commAmount,
              debit: 0,
              receipt_no: '-',
              particulars: 'Opening CD Commission Charged',
              user_name: editedBy,
              entry_type: 'opening_commission',
              total_paid: 0
            }]);
          }

          // document_charge entry
          const docEntry = existingEntries.find((e: any) => e.entry_type === 'document_charge');
          if (docEntry) {
            if (docCharges > 0) {
              await supabase
                .from('finance_cd_ledger_entries')
                .update({
                  credit: docCharges,
                  date: data.date,
                  entry_date: data.date
                })
                .eq('id', docEntry.id);
            } else {
              await supabase
                .from('finance_cd_ledger_entries')
                .delete()
                .eq('id', docEntry.id);
            }
          } else if (docCharges > 0) {
            await supabase.from('finance_cd_ledger_entries').insert([{
              loan_id: id,
              customer_id: data.customer_id,
              account_name: 'CD DOCUMENT CHARGES A/C',
              date: data.date,
              entry_date: data.date,
              credit: docCharges,
              debit: 0,
              receipt_no: '-',
              particulars: 'Document Charges Collected',
              user_name: editedBy,
              entry_type: 'document_charge',
              total_paid: 0
            }]);
          }
        }

        // 3. Delete and regenerate dues schedule in finance_dues
        await supabase
          .from('finance_dues')
          .delete()
          .eq('loan_id', id);

        let duesCount = 0;
        let dueAmount = 0;

        if (data.loan_category === 'CD') {
          duesCount = data.period_days || data.duration_months || 30;
          dueAmount = 0;
        } else {
          if (data.due_type === 'Daily') {
            duesCount = data.duration_months * 30;
          } else if (data.due_type === 'Weekly') {
            duesCount = Math.round(data.duration_months * 4.33);
          } else {
            duesCount = data.duration_months;
          }
          dueAmount = data.due_amount;
        }

        const duesList = [];
        const startDate = new Date(data.date);
        for (let i = 1; i <= duesCount; i++) {
          const dDate = new Date(startDate);
          if (data.loan_category === 'CD') {
            dDate.setDate(startDate.getDate() + i);
          } else {
            if (data.due_type === 'Daily') {
              dDate.setDate(startDate.getDate() + i);
            } else if (data.due_type === 'Weekly') {
              dDate.setDate(startDate.getDate() + i * 7);
            } else {
              dDate.setMonth(startDate.getMonth() + i);
            }
          }
          duesList.push({
            loan_id: id,
            due_date: dDate.toISOString().split('T')[0],
            amount: dueAmount,
            paid_amount: 0,
            status: 'Pending'
          });
        }

        if (duesList.length > 0) {
          const { error: insertDuesError } = await supabase
            .from('finance_dues')
            .insert(duesList);
          if (insertDuesError) throw insertDuesError;
        }
      }

      // 4. Sync finance_npa_records if exists
      const { data: npaRecord } = await supabase
        .from('finance_npa_records')
        .select('*')
        .eq('loan_id', id)
        .maybeSingle();

      if (npaRecord) {
        const newLiability = Number(data.amount) + Number(npaRecord.interest_due || 0) + Number(npaRecord.penalty_due || 0);
        await supabase
          .from('finance_npa_records')
          .update({
            loan_amount: Number(data.amount),
            balance_amount: Number(data.amount),
            total_liability: newLiability,
            waived_amount: Math.max(0, newLiability - Number(npaRecord.settlement_amount || 0))
          })
          .eq('id', npaRecord.id);
      }

      if (oldData && !skipLogging) {
        await this.logEdit('finance_loans', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance loan:', error);
      return null;
    }
  }

  async deleteLoan(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_loans')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_loans')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_loans', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance loan:', error);
      return false;
    }
  }

  // --- Transactions (Collections & Disbursements) ---
  async getTransactions(filters?: { startDate?: string; endDate?: string }): Promise<(FinanceTransaction & { loan: FinanceLoan & { customer: FinanceCustomer } })[]> {
    try {
      let query = supabase
        .from('finance_transactions')
        .select('*, loan:finance_loans(*, customer:finance_customers!customer_id(*))')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance transactions:', error);
      return [];
    }
  }

  async createTransaction(transaction: Omit<FinanceTransaction, 'id' | 'created_at' | 'updated_at'>, _editedBy: string): Promise<FinanceTransaction | null> {
    try {
      const { data, error } = await supabase
        .from('finance_transactions')
        .insert([transaction])
        .select()
        .single();
      if (error) throw error;

      // Recalculate dues paid amounts for this loan to keep payment schedule correctly allocated
      if (transaction.type === 'Collection') {
        await this.recalculateDuesForLoan(transaction.loan_id);
      }

      return data;
    } catch (error) {
      console.error('Error creating finance transaction:', error);
      return null;
    }
  }

  async deleteTransaction(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (!oldData) return false;

      const { error } = await supabase
        .from('finance_transactions')
        .delete()
        .eq('id', id);
      if (error) throw error;

      await this.logDelete('finance_transactions', id, oldData, deletedBy);

      // Recalculate dues allocation if deleting a collection
      if (oldData.type === 'Collection') {
        await this.recalculateDuesForLoan(oldData.loan_id);
      }

      return true;
    } catch (error) {
      console.error('Error deleting finance transaction:', error);
      return false;
    }
  }

  // Helper method: Reset and recalculate dues payments sequentially for a loan
  async recalculateDuesForLoan(loanId: string): Promise<void> {
    try {
      // 1. Get all Collections transactions for the loan
      const { data: collections, error: collectionsError } = await supabase
        .from('finance_transactions')
        .select('amount')
        .eq('loan_id', loanId)
        .eq('type', 'Collection')
        .order('date', { ascending: true })
        .order('created_at', { ascending: true });

      if (collectionsError) throw collectionsError;

      // Sum of all collections
      let totalCollected = (collections || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

      // 2. Get all dues for this loan
      const { data: dues, error: duesError } = await supabase
        .from('finance_dues')
        .select('*')
        .eq('loan_id', loanId)
        .order('due_date', { ascending: true });

      if (duesError) throw duesError;
      if (!dues || dues.length === 0) return;

      // 3. Sequentially allocate the totalCollected amount
      const updatedDues = dues.map(due => {
        const dueAmount = Number(due.amount);
        let paidAmount = 0;
        let status: 'Pending' | 'Paid' | 'Partially Paid' = 'Pending';

        if (totalCollected >= dueAmount) {
          paidAmount = dueAmount;
          status = 'Paid';
          totalCollected -= dueAmount;
        } else if (totalCollected > 0) {
          paidAmount = totalCollected;
          status = 'Partially Paid';
          totalCollected = 0;
        }

        return {
          id: due.id,
          paid_amount: paidAmount,
          status: status,
          updated_at: new Date().toISOString()
        };
      });

      // 4. Update each due record in Supabase
      // Note: We perform individual updates or bulk if supported, individual is simple and safe for typical loan dues counts (e.g. 50-100)
      for (const due of updatedDues) {
        await supabase
          .from('finance_dues')
          .update({
            paid_amount: due.paid_amount,
            status: due.status,
            updated_at: due.updated_at
          })
          .eq('id', due.id);
      }

      console.log(`✅ Recalculated dues for loan ${loanId}. Remaining collections: ${totalCollected}`);
    } catch (error) {
      console.error('Error recalculating dues for loan:', error);
    }
  }

  // --- Capital Entries ---
  async getCapitalEntries(): Promise<(FinanceCapitalEntry & { partner: FinancePartner })[]> {
    try {
      const { data, error } = await supabase
        .from('finance_capital_entries')
        .select('*, partner:finance_partners(*)')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance capital entries:', error);
      return [];
    }
  }

  async createCapitalEntry(entry: Omit<FinanceCapitalEntry, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCapitalEntry | null> {
    try {
      const { data, error } = await supabase
        .from('finance_capital_entries')
        .insert([entry])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating finance capital entry:', error);
      return null;
    }
  }

  async createCapitalEntries(entries: Omit<FinanceCapitalEntry, 'id' | 'created_at' | 'updated_at'>[]): Promise<FinanceCapitalEntry[] | null> {
    try {
      const { data, error } = await supabase
        .from('finance_capital_entries')
        .insert(entries)
        .select();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating bulk finance capital entries:', error);
      return null;
    }
  }

  async updateCapitalEntry(
    id: string,
    entry: Partial<Omit<FinanceCapitalEntry, 'id' | 'created_at' | 'updated_at'>>,
    updatedBy: string
  ): Promise<FinanceCapitalEntry | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_capital_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_capital_entries')
        .update(entry)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData && data) {
        await this.logEdit('finance_capital_entries', id, oldData, data, updatedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating finance capital entry:', error);
      return null;
    }
  }

  async deleteCapitalEntry(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_capital_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_capital_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_capital_entries', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting finance capital entry:', error);
      return false;
    }
  }

  // --- Photos ---
  async addPhoto(photo: Omit<FinancePhoto, 'id' | 'created_at'>): Promise<FinancePhoto | null> {
    try {
      const { data, error } = await supabase
        .from('finance_photos')
        .insert([photo])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding photo:', error);
      return null;
    }
  }

  // --- Documents ---
  async getLoanDocuments(loanId: string): Promise<FinanceLoanDocument[]> {
    try {
      const { data, error } = await supabase
        .from('finance_loan_documents')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance loan documents:', error);
      return [];
    }
  }

  async getDocuments(loanId: string): Promise<FinanceDocument[]> {
    try {
      const { data, error } = await supabase
        .from('finance_documents')
        .select('*')
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching finance documents:', error);
      return [];
    }
  }

  async addDocument(doc: Omit<FinanceDocument, 'id' | 'created_at'>): Promise<FinanceDocument | null> {
    try {
      const { data, error } = await supabase
        .from('finance_documents')
        .insert([doc])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding finance document:', error);
      return null;
    }
  }

  async addLoanDocument(doc: {
    loan_id: string;
    category: string;
    document_name: string;
    remarks?: string | null;
    file_url: string | null;
    is_submitted?: boolean;
  }): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('finance_loan_documents')
        .insert([{
          loan_id: doc.loan_id,
          category: doc.category,
          document_name: doc.document_name,
          remarks: doc.remarks || null,
          file_url: doc.file_url,
          is_submitted: doc.is_submitted ?? true
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding finance loan document:', error);
      return null;
    }
  }

  async deleteDocument(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('finance_loan_documents')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting finance document:', error);
      return false;
    }
  }


  // --- Audit Logs ---
  async logEdit(tableName: string, recordId: string, oldValues: any, newValues: any, editedBy: string): Promise<void> {
    try {
      await supabase
        .from('finance_edited_logs')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          old_values: oldValues,
          new_values: newValues,
          edited_by: editedBy
        }]);
    } catch (error) {
      console.error('Error writing edit log:', error);
    }
  }

  async logDelete(tableName: string, recordId: string, oldValues: any, deletedBy: string): Promise<void> {
    try {
      await supabase
        .from('finance_deleted_logs')
        .insert([{
          table_name: tableName,
          record_id: recordId,
          old_values: oldValues,
          deleted_by: deletedBy
        }]);
    } catch (error) {
      console.error('Error writing delete log:', error);
    }
  }

  async getEditedLogs(): Promise<FinanceEditedLog[]> {
    try {
      const { data, error } = await supabase
        .from('finance_edited_logs')
        .select('*')
        .order('edited_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching edited logs:', error);
      return [];
    }
  }

  async getDeletedLogs(): Promise<FinanceDeletedLog[]> {
    try {
      const { data, error } = await supabase
        .from('finance_deleted_logs')
        .select('*')
        .order('deleted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching deleted logs:', error);
      return [];
    }
  }

  // --- User Access & Permissions Management ---
  async getFinanceUsersPermissions(): Promise<Record<string, string[]>> {
    try {
      const { data, error } = await supabase
        .from('finance_user_permissions')
        .select('user_id, feature_key');
      if (error) throw error;

      const map: Record<string, string[]> = {};
      (data || []).forEach(row => {
        if (!map[row.user_id]) {
          map[row.user_id] = [];
        }
        if (row.feature_key) {
          map[row.user_id].push(row.feature_key);
        }
      });
      return map;
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      return {};
    }
  }

  async updateFinanceUserPermissions(userId: string, featureKeys: string[]): Promise<boolean> {
    try {
      // 1. Delete all existing finance permissions for this user
      const { error: deleteError } = await supabase
        .from('finance_user_permissions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 2. Insert new permissions if there are any
      if (featureKeys.length > 0) {
        const rows = featureKeys.map(key => ({
          user_id: userId,
          feature_key: key
        }));

        const { error: insertError } = await supabase
          .from('finance_user_permissions')
          .insert(rows);

        if (insertError) throw insertError;
      }

      return true;
    } catch (error) {
      console.error('Error updating finance user permissions:', error);
      return false;
    }
  }

  async restoreDeletedRecord(logId: string, tableName: string, oldValues: any, _staffName: string): Promise<boolean> {
    try {
      const { error: insertError } = await supabase
        .from(tableName)
        .insert([oldValues]);
      if (insertError) throw insertError;

      const { error: logDeleteError } = await supabase
        .from('finance_deleted_logs')
        .delete()
        .eq('id', logId);
      if (logDeleteError) throw logDeleteError;

      return true;
    } catch (error) {
      console.error('Error restoring deleted record:', error);
      return false;
    }
  }

  // --- Cashbook Accounts ---
  async getCashbookAccounts(): Promise<FinanceCashbookAccount[]> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_accounts')
        .select('*')
        .order('account_name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cashbook accounts:', error);
      return [];
    }
  }

  async createCashbookAccount(account: Omit<FinanceCashbookAccount, 'id' | 'created_at'>): Promise<FinanceCashbookAccount | null> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_accounts')
        .insert([account])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cashbook account:', error);
      return null;
    }
  }

  // --- Cashbook Entries ---
  async getCashbookEntries(): Promise<FinanceCashbookEntry[]> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cashbook entries:', error);
      return [];
    }
  }

  async createCashbookEntry(entry: Omit<FinanceCashbookEntry, 'id' | 'created_at' | 'updated_at'>): Promise<FinanceCashbookEntry | null> {
    try {
      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .insert([entry])
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating cashbook entry:', error);
      return null;
    }
  }

  async updateCashbookEntry(id: string, entry: Partial<FinanceCashbookEntry>, editedBy: string): Promise<FinanceCashbookEntry | null> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('finance_cashbook_entries')
        .update({ ...entry, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      if (oldData) {
        await this.logEdit('finance_cashbook_entries', id, oldData, data, editedBy);
      }
      return data;
    } catch (error) {
      console.error('Error updating cashbook entry:', error);
      return null;
    }
  }

  async deleteCashbookEntry(id: string, deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('finance_cashbook_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (oldData) {
        await this.logDelete('finance_cashbook_entries', id, oldData, deletedBy);
      }
      return true;
    } catch (error) {
      console.error('Error deleting cashbook entry:', error);
      return false;
    }
  }

  async deleteAllCashbookEntries(deletedBy: string): Promise<boolean> {
    try {
      const { data: oldData } = await supabase
        .from('finance_cashbook_entries')
        .select('*');

      const { error } = await supabase
        .from('finance_cashbook_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;

      if (oldData && oldData.length > 0) {
        for (const row of oldData) {
          await this.logDelete('finance_cashbook_entries', row.id, row, deletedBy);
        }
      }
      return true;
    } catch (error) {
      console.error('Error deleting all cashbook entries:', error);
      return false;
    }
  }

  // --- Utility for Calendar Indicators ---
  async getAllFinanceEntryDates(): Promise<{ c_date: string }[]> {
    try {
      const results = await Promise.all([
        supabase.from('finance_loans').select('date'),
        supabase.from('finance_transactions').select('date'),
        supabase.from('finance_cashbook_entries').select('entry_date'),
        supabase.from('finance_capital_entries').select('entry_date'),
        supabase.from('finance_customers').select('created_at'),
        supabase.from('finance_edited_logs').select('edited_at'),
        supabase.from('finance_deleted_logs').select('deleted_at')
      ]);

      const datesSet = new Set<string>();

      const addDate = (d: any) => {
        if (typeof d === 'string') {
          if (d.includes('T')) {
            const dateObj = new Date(d);
            if (!isNaN(dateObj.getTime())) {
               const y = dateObj.getFullYear();
               const m = String(dateObj.getMonth() + 1).padStart(2, '0');
               const day = String(dateObj.getDate()).padStart(2, '0');
               datesSet.add(`${y}-${m}-${day}`);
               return;
            }
          }
          const match = d.match(/^(\d{4}-\d{2}-\d{2})/);
          if (match) {
            datesSet.add(match[1]);
          }
        }
      };

      results[0].data?.forEach(r => addDate(r.date));
      results[1].data?.forEach(r => addDate(r.date));
      results[2].data?.forEach(r => addDate(r.entry_date));
      results[3].data?.forEach(r => addDate(r.entry_date));
      results[4].data?.forEach(r => addDate(r.created_at));
      results[5].data?.forEach(r => addDate(r.edited_at));
      results[6].data?.forEach(r => addDate(r.deleted_at));

      return Array.from(datesSet).map(d => ({ c_date: d }));
    } catch (error) {
      console.error('Error fetching finance entry dates:', error);
      return [];
    }
  }
}

export const supabaseFinance = new SupabaseFinance();
