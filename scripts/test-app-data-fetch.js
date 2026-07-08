#!/usr/bin/env node

/**
 * Test App Data Fetch Script
 * Tests the exact data fetching logic your app uses
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

console.log('🧪 App Data Fetch Test Script for Thirumala Business Management System');
console.log('====================================================================\n');

async function testAppDataFetch() {
  try {
    console.log('🔍 Testing the exact data fetching logic your app uses...\n');
    
    // Test 1: Direct query (what your app does)
    console.log('📊 Test 1: Direct Supabase query (like your app)');
    const { data: directData, error: directError } = await supabase
      .from('cash_book')
      .select('*')
      .order('c_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (directError) {
      console.error(`❌ Direct query failed: ${directError.message}`);
    } else {
      console.log(`✅ Direct query successful: ${directData?.length || 0} records returned`);
      
      if (directData && directData.length > 0) {
        console.log('\n📋 First 5 records from direct query:');
        console.table(directData.slice(0, 5));
      }
    }
    
    // Test 2: Check for specific data types
    console.log('\n🔍 Test 2: Checking data structure and content');
    if (directData && directData.length > 0) {
      const firstRecord = directData[0];
      console.log('📋 First record structure:');
      console.log(`   - id: ${firstRecord.id}`);
      console.log(`   - sno: ${firstRecord.sno}`);
      console.log(`   - acc_name: ${firstRecord.acc_name}`);
      console.log(`   - c_date: ${firstRecord.c_date}`);
      console.log(`   - company_name: ${firstRecord.company_name}`);
      console.log(`   - entry_time: ${firstRecord.entry_time}`);
      
      // Check for 2017 data specifically
      const data2017 = directData.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`\n📅 2017 data found: ${data2017.length} records`);
      
      if (data2017.length > 0) {
        console.log('📋 Sample 2017 records:');
        console.table(data2017.slice(0, 3));
      }
    }
    
    // Test 3: Test the exact query your app uses in loadEntries
    console.log('\n🔍 Test 3: Testing app-like query with error handling');
    try {
      console.log('🔍 Loading entries from database...');
      
      // First, try direct Supabase query to check if RLS is blocking access
      const { data: directData2, error: directError2 } = await supabase
        .from('cash_book')
        .select('*')
        .order('c_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (directError2) {
        console.error('❌ Direct Supabase query failed:', directError2);
        console.log('🔒 This suggests an RLS issue');
        return;
      }

      console.log('✅ Direct Supabase query successful, found', directData2?.length || 0, 'entries');
      
      // Now test the wrapper function logic
      let allEntries = directData2 || [];
      console.log('✅ Wrapper function would return', allEntries.length, 'entries');
      
      // Test filtering (like your app does)
      console.log('\n🧪 Testing filtering logic:');
      
      // Test year filter for 2017
      const year2017Filter = allEntries.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`📅 Year 2017 filter: ${year2017Filter.length} entries`);
      
      // Test company filter
      const companyFilter = allEntries.filter(entry => 
        entry.company_name && entry.company_name.includes('BR AND BVT')
      );
      console.log(`🏢 Company "BR AND BVT" filter: ${companyFilter.length} entries`);
      
      if (year2017Filter.length > 0) {
        console.log('\n📋 Sample 2017 entries:');
        console.table(year2017Filter.slice(0, 3));
      }
      
    } catch (error) {
      console.error('❌ Error during app-like query test:', error.message);
    }
    
    console.log('\n🔍 Analysis Complete!');
    console.log('💡 If the direct query works but your app doesn\'t show data:');
    console.log('   1. Check your app\'s console for errors');
    console.log('   2. Verify the data is being set in state correctly');
    console.log('   3. Check if there are any additional filters applied');
    
  } catch (error) {
    console.error('❌ Error during app data fetch test:', error.message);
  }
}

// Run the test
testAppDataFetch();













