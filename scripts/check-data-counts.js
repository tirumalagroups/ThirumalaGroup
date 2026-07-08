#!/usr/bin/env node

/**
 * Data Count Verification Script for Thirumala Business Management System
 * Checks actual record counts in database tables after CSV import
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl, supabaseAnonKey;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
  
  supabaseUrl = envVars.VITE_SUPABASE_URL;
  supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY;
}

// Fallback to hardcoded values if env not found
if (!supabaseUrl) {
  supabaseUrl = process.env.VITE_SUPABASE_URL || '';
}

if (!supabaseAnonKey) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not found in .env file');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 Data Count Verification Script for Thirumala Business Management System');
console.log('=====================================================================\n');

async function checkTableCounts() {
  try {
    console.log('📊 Checking table record counts...\n');
    
    // Check companies table
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (companiesError) {
      console.error('❌ Error checking companies table:', companiesError.message);
    } else {
      console.log(`🏢 Companies table: ${companiesCount} records`);
    }
    
    // Check cash_book table
    const { count: cashBookCount, error: cashBookError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (cashBookError) {
      console.error('❌ Error checking cash_book table:', cashBookError.message);
    } else {
      console.log(`💰 Cash Book table: ${cashBookCount} records`);
    }
    
    // Check other related tables
    const { count: mainAccountsCount, error: mainAccountsError } = await supabase
      .from('company_main_accounts')
      .select('*', { count: 'exact', head: true });
    
    if (mainAccountsError) {
      console.error('❌ Error checking company_main_accounts table:', mainAccountsError.message);
    } else {
      console.log(`📋 Company Main Accounts: ${mainAccountsCount} records`);
    }
    
    const { count: subAccountsCount, error: subAccountsError } = await supabase
      .from('company_main_sub_acc')
      .select('*', { count: 'exact', head: true });
    
    if (subAccountsError) {
      console.error('❌ Error checking company_main_sub_acc table:', subAccountsError.message);
    } else {
      console.log(`📝 Company Sub Accounts: ${subAccountsCount} records`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Show sample data from cash_book
    console.log('\n📋 Sample records from cash_book table:');
    const { data: sampleRecords, error: sampleError } = await supabase
      .from('cash_book')
      .select('sno, acc_name, sub_acc_name, particulars, c_date, credit, debit, company_name')
      .order('sno', { ascending: true })
      .limit(5);
    
    if (sampleError) {
      console.error('❌ Error fetching sample records:', sampleError.message);
    } else if (sampleRecords && sampleRecords.length > 0) {
      console.table(sampleRecords);
    } else {
      console.log('⚠️  No records found in cash_book table');
    }
    
    // Show sample companies
    console.log('\n🏢 Sample companies:');
    const { data: sampleCompanies, error: companiesSampleError } = await supabase
      .from('companies')
      .select('company_name, address')
      .order('company_name', { ascending: true })
      .limit(10);
    
    if (companiesSampleError) {
      console.error('❌ Error fetching sample companies:', companiesSampleError.message);
    } else if (sampleCompanies && sampleCompanies.length > 0) {
      console.table(sampleCompanies);
    } else {
      console.log('⚠️  No companies found');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   Expected CSV records: 67,117`);
    console.log(`   Actual cash_book records: ${cashBookCount || 0}`);
    console.log(`   Expected companies: 31`);
    console.log(`   Actual companies: ${companiesCount || 0}`);
    
    if (cashBookCount === 67117 && companiesCount === 31) {
      console.log('\n✅ SUCCESS: All data imported correctly!');
    } else {
      console.log('\n⚠️  WARNING: Data count mismatch detected!');
      console.log('   Please check the import process or run it again.');
    }
    
  } catch (error) {
    console.error('❌ Error checking table counts:', error.message);
  }
}

// Run the verification
checkTableCounts();

