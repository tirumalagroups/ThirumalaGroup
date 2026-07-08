#!/usr/bin/env node

/**
 * Complete Data Cleanup Script for Thirumala Business Management System
 * Deletes all existing data to prepare for fresh import
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

console.log('🧹 Complete Data Cleanup Script for Thirumala Business Management System');
console.log('=====================================================================\n');

async function cleanupAllData() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data from your database!');
    console.log('   This action cannot be undone.\n');
    
    // Get current counts
    console.log('📊 Current data counts:');
    
    const { count: cashBookCount, error: cashBookError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (cashBookError) {
      console.error('❌ Error getting cash_book count:', cashBookError.message);
    } else {
      console.log(`   💰 Cash Book: ${cashBookCount} records`);
    }
    
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (companiesError) {
      console.error('❌ Error getting companies count:', companiesError.message);
    } else {
      console.log(`   🏢 Companies: ${companiesCount} records`);
    }
    
    const { count: mainAccountsCount, error: mainAccountsError } = await supabase
      .from('company_main_accounts')
      .select('*', { count: 'exact', head: true });
    
    if (mainAccountsError) {
      console.error('❌ Error getting company_main_accounts count:', mainAccountsError.message);
    } else {
      console.log(`   📋 Company Main Accounts: ${mainAccountsCount} records`);
    }
    
    const { count: subAccountsCount, error: subAccountsError } = await supabase
      .from('company_main_sub_acc')
      .select('*', { count: 'exact', head: true });
    
    if (subAccountsError) {
      console.error('❌ Error getting company_main_sub_acc count:', subAccountsError.message);
    } else {
      console.log(`   📝 Company Sub Accounts: ${subAccountsCount} records`);
    }
    
    console.log('\n🔴 To proceed with cleanup, please type "YES" to confirm:');
    
    // For safety, we'll just show what would be deleted
    console.log('\n📋 Records that would be deleted:');
    console.log(`   - All ${cashBookCount || 0} cash book records`);
    console.log(`   - All ${companiesCount || 0} companies`);
    console.log(`   - All ${mainAccountsCount || 0} main accounts`);
    console.log(`   - All ${subAccountsCount || 0} sub accounts`);
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('   1. Backup your data first if needed');
    console.log('   2. Run the cleanup SQL in Supabase SQL Editor');
    console.log('   3. Run the fresh import script');
    
    // Show the cleanup SQL
    console.log('\n🔧 Cleanup SQL (run in Supabase SQL Editor):');
    console.log('```sql');
    console.log('-- Clean up all data');
    console.log('DELETE FROM cash_book;');
    console.log('DELETE FROM companies;');
    console.log('DELETE FROM company_main_accounts;');
    console.log('DELETE FROM company_main_sub_acc;');
    console.log('');
    console.log('-- Reset auto-increment counters');
    console.log('ALTER SEQUENCE cash_book_sno_seq RESTART WITH 1;');
    console.log('');
    console.log('-- Verify cleanup');
    console.log('SELECT COUNT(*) FROM cash_book;');
    console.log('SELECT COUNT(*) FROM companies;');
    console.log('SELECT COUNT(*) FROM company_main_accounts;');
    console.log('SELECT COUNT(*) FROM company_main_sub_acc;');
    console.log('```');
    
    console.log('\n📝 Next steps:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Run the cleanup SQL above');
    console.log('   4. Come back and run the fresh import script');
    
    console.log('\n🚀 After cleanup, you can run:');
    console.log('   node scripts/import-csv-complete.js');
    
  } catch (error) {
    console.error('❌ Error during cleanup analysis:', error.message);
  }
}

// Run the cleanup analysis
cleanupAllData();

