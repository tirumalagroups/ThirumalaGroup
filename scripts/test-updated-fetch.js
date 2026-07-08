#!/usr/bin/env node

/**
 * Test Updated Fetch Script
 * Tests the updated getCashBookEntries function with higher limits
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

console.log('🧪 Updated Fetch Test Script for Thirumala Business Management System');
console.log('===================================================================\n');

async function testUpdatedFetch() {
  try {
    console.log('🔍 Testing updated fetch logic...\n');
    
    // Test 1: Direct query with high limit (what the updated function does)
    console.log('📊 Test 1: Direct query with limit(100000)');
    const { data: highLimitData, error: highLimitError } = await supabase
      .from('cash_book')
      .select('*')
      .order('c_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100000);

    if (highLimitError) {
      console.error(`❌ High limit query failed: ${highLimitError.message}`);
    } else {
      console.log(`✅ High limit query successful: ${highLimitData?.length || 0} records returned`);
      
      if (highLimitData && highLimitData.length > 0) {
        // Check for 2017 data
        const data2017 = highLimitData.filter(entry => 
          entry.c_date && entry.c_date.startsWith('2017')
        );
        console.log(`📅 2017 data found: ${data2017.length} records`);
        
        if (data2017.length > 0) {
          console.log('📋 Sample 2017 records:');
          console.table(data2017.slice(0, 3));
        }
        
        // Check for specific date
        const specificDate = highLimitData.filter(entry => 
          entry.c_date === '2017-01-21'
        );
        console.log(`📅 2017-01-21 data found: ${specificDate.length} records`);
      }
    }
    
    // Test 2: Check if we can get more than 1000 records
    console.log('\n📊 Test 2: Checking record count beyond 1000');
    if (highLimitData && highLimitData.length > 1000) {
      console.log(`✅ Successfully fetched ${highLimitData.length} records (beyond 1000 limit)`);
      
      // Check data distribution across years
      const yearCounts = {};
      highLimitData.forEach(entry => {
        if (entry.c_date) {
          const year = entry.c_date.substring(0, 4);
          yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
      });
      
      console.log('\n📅 Data distribution by year:');
      Object.entries(yearCounts)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([year, count]) => {
          console.log(`   ${year}: ${count} records`);
        });
    } else {
      console.log(`⚠️  Only ${highLimitData?.length || 0} records returned (still limited)`);
    }
    
    console.log('\n✅ Updated fetch test complete!');
    console.log('💡 If you now see more than 1000 records:');
    console.log('   1. Your app should now show all data');
    console.log('   2. Date filtering should work for 2017 and other years');
    console.log('   3. The "No entries found" message should disappear');
    
  } catch (error) {
    console.error('❌ Error during updated fetch test:', error.message);
  }
}

// Run the test
testUpdatedFetch();













