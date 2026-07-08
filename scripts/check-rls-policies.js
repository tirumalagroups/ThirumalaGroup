#!/usr/bin/env node

/**
 * Check RLS Policies Script
 * Tests data access and checks for RLS policy issues
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

console.log('🔒 RLS Policy Check Script for Thirumala Business Management System');
console.log('==================================================================\n');

async function checkRLSPolicies() {
  try {
    console.log('🔍 Testing data access...\n');
    
    // Test 1: Basic count query
    console.log('📊 Test 1: Basic count query');
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error(`❌ Count query failed: ${countError.message}`);
      if (countError.message.includes('permission') || countError.message.includes('policy')) {
        console.log('🔒 This is an RLS policy issue!');
      }
    } else {
      console.log(`✅ Count query successful: ${totalCount} records found`);
    }
    
    // Test 2: Simple select query
    console.log('\n📊 Test 2: Simple select query (limit 5)');
    const { data: sampleData, error: selectError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, company_name')
      .limit(5);
    
    if (selectError) {
      console.error(`❌ Select query failed: ${selectError.message}`);
      if (selectError.message.includes('permission') || selectError.message.includes('policy')) {
        console.log('🔒 This is an RLS policy issue!');
      }
    } else {
      console.log(`✅ Select query successful: ${sampleData?.length || 0} records returned`);
      if (sampleData && sampleData.length > 0) {
        console.table(sampleData);
      }
    }
    
    // Test 3: Query with date filter
    console.log('\n📊 Test 3: Query with date filter (2017 data)');
    const { data: dateFilterData, error: dateFilterError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, company_name')
      .gte('c_date', '2017-01-01')
      .lte('c_date', '2017-12-31')
      .limit(5);
    
    if (dateFilterError) {
      console.error(`❌ Date filter query failed: ${dateFilterError.message}`);
    } else {
      console.log(`✅ Date filter query successful: ${dateFilterError?.length || 0} records returned`);
      if (dateFilterData && dateFilterData.length > 0) {
        console.table(dateFilterData);
      }
    }
    
    // Test 4: Check if RLS is enabled
    console.log('\n🔒 Test 4: Checking RLS status');
    try {
      const { data: rlsCheck, error: rlsError } = await supabase
        .rpc('check_rls_status', { table_name: 'cash_book' });
      
      if (rlsError) {
        console.log('ℹ️  RLS status check not available, but we can infer from errors');
      } else {
        console.log(`✅ RLS status: ${rlsCheck}`);
      }
    } catch (error) {
      console.log('ℹ️  RLS status check not available');
    }
    
    console.log('\n🔍 RLS Policy Analysis:');
    if (countError && (countError.message.includes('permission') || countError.message.includes('policy'))) {
      console.log('❌ RLS policies are blocking access to cash_book table');
      console.log('💡 Solution: Disable RLS or create proper policies');
      console.log('\n🔧 To fix this, you need to:');
      console.log('   1. Go to your Supabase Dashboard');
      console.log('   2. Navigate to Authentication > Policies');
      console.log('   3. Find the cash_book table');
      console.log('   4. Either disable RLS or create a policy that allows SELECT');
    } else if (countError) {
      console.log('❌ Database access issue (not RLS):', countError.message);
    } else {
      console.log('✅ RLS policies are working correctly');
      console.log('💡 The issue might be in your app\'s filtering logic');
    }
    
  } catch (error) {
    console.error('❌ Error during RLS check:', error.message);
  }
}

// Run the check
checkRLSPolicies();













