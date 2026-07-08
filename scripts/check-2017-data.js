#!/usr/bin/env node

/**
 * Check 2017 Data Script
 * Specifically checks for 2017 data in the database
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

console.log('🔍 2017 Data Check Script for Thirumala Business Management System');
console.log('================================================================\n');

async function check2017Data() {
  try {
    console.log('📊 Checking for 2017 data...\n');
    
    // Check total count
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting total count:', countError.message);
      return;
    }
    
    console.log(`📈 Total records in database: ${totalCount}`);
    
    // Check specifically for 2017 data
    console.log('\n📅 Checking for 2017 data specifically:');
    const { data: data2017, error: error2017 } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name, entry_time')
      .gte('c_date', '2017-01-01')
      .lte('c_date', '2017-12-31')
      .order('c_date', { ascending: false })
      .limit(20);
    
    if (error2017) {
      console.error('❌ Error getting 2017 data:', error2017.message);
    } else {
      if (data2017 && data2017.length > 0) {
        console.table(data2017);
        console.log(`✅ Found ${data2017.length} entries from 2017`);
        
        // Check if these are from the new import (should have matching entry_time)
        const matchingDates = data2017.filter(entry => {
          const cDate = new Date(entry.c_date);
          const entryTime = new Date(entry.entry_time);
          return cDate.getFullYear() === entryTime.getFullYear() && 
                 cDate.getMonth() === entryTime.getMonth() && 
                 cDate.getDate() === entryTime.getDate();
        });
        
        console.log(`📅 Date matching check: ${matchingDates.length}/${data2017.length} entries have matching dates`);
      } else {
        console.log('❌ No 2017 data found in database');
      }
    }
    
    // Check for any data with dates 2016-2025 (should be the new import)
    console.log('\n📅 Checking for data from 2016-2025 (new import):');
    const { data: newImportData, error: newImportError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name, entry_time')
      .gte('c_date', '2016-01-01')
      .lte('c_date', '2025-12-31')
      .order('c_date', { ascending: false })
      .limit(20);
    
    if (newImportError) {
      console.error('❌ Error getting new import data:', newImportError.message);
    } else {
      if (newImportData && newImportData.length > 0) {
        console.table(newImportData);
        console.log(`✅ Found ${newImportData.length} entries from 2016-2025`);
      } else {
        console.log('❌ No data from 2016-2025 found');
      }
    }
    
    // Check what the app might be filtering by
    console.log('\n🔍 Checking what might be causing the filtering issue:');
    console.log('   - Are you filtering by date range in the app?');
    console.log('   - Are you filtering by company?');
    console.log('   - Are you filtering by account?');
    console.log('   - Is there a search term applied?');
    
    // Test the exact query your app might be using
    console.log('\n🧪 Testing app-like query (with date filter):');
    const { data: appQueryData, error: appQueryError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name')
      .gte('c_date', '2017-01-01')
      .lte('c_date', '2017-12-31')
      .order('c_date', { ascending: false });
    
    if (appQueryError) {
      console.error('❌ App-like query failed:', appQueryError.message);
    } else {
      if (appQueryData && appQueryData.length > 0) {
        console.log(`✅ App-like query found ${appQueryData.length} entries from 2017`);
        console.log('   This means the data exists and is queryable');
        console.log('   The issue might be in your app\'s filtering logic');
      } else {
        console.log('❌ App-like query found no data from 2017');
        console.log('   This suggests a database or query issue');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during 2017 data check:', error.message);
  }
}

// Run the check
check2017Data();













