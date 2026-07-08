#!/usr/bin/env node

/**
 * Debug App Fetch Script
 * Tests the exact data fetching logic your app uses step by step
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

console.log('🐛 Debug App Fetch Script for Thirumala Business Management System');
console.log('==================================================================\n');

async function debugAppFetch() {
  try {
    console.log('🔍 Step-by-step debugging of app data fetching...\n');
    
    // Step 1: Test basic connection and count
    console.log('📊 Step 1: Testing basic connection and count');
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error(`❌ Count query failed: ${countError.message}`);
      return;
    }
    console.log(`✅ Total records in database: ${totalCount}\n`);
    
    // Step 2: Test the exact query your app uses (direct Supabase)
    console.log('📊 Step 2: Testing direct Supabase query (what your app does first)');
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
        console.log('📋 First 3 records from direct query:');
        console.table(directData.slice(0, 3));
      }
    }
    
    // Step 3: Test high limit query (what the updated function tries first)
    console.log('\n📊 Step 3: Testing high limit query (limit 100000)');
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
      }
    }
    
    // Step 4: Test batch fetching logic (what the updated function falls back to)
    console.log('\n📊 Step 4: Testing batch fetching logic');
    
    // Simulate the batch approach
    let allEntries = [];
    const batchSize = 1000;
    
    if (totalCount && totalCount > 1000) {
      console.log(`🔄 Fetching ${totalCount} records in batches of ${batchSize}...`);
      
      // Just fetch first few batches to test
      const maxBatches = 5; // Limit for testing
      let batchCount = 0;
      
      for (let offset = 0; offset < Math.min(totalCount, maxBatches * batchSize); offset += batchSize) {
        batchCount++;
        console.log(`   → Fetching batch ${batchCount} (offset ${offset} to ${offset + batchSize - 1})`);
        
        const { data: batchData, error: batchError } = await supabase
          .from('cash_book')
          .select('*')
          .order('c_date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          console.error(`   ❌ Batch ${batchCount} failed: ${batchError.message}`);
          continue;
        }

        if (batchData) {
          allEntries = allEntries.concat(batchData);
          console.log(`   ✅ Batch ${batchCount} successful: ${batchData.length} records`);
        }

        // Small delay between batches
        if (offset + batchSize < Math.min(totalCount, maxBatches * batchSize)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✅ Successfully fetched ${allEntries.length} records in ${batchCount} batches`);
      
      // Check for 2017 data in fetched batches
      const data2017 = allEntries.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`📅 2017 data in fetched batches: ${data2017.length} records`);
      
      if (data2017.length > 0) {
        console.log('📋 Sample 2017 records from batches:');
        console.table(data2017.slice(0, 3));
      }
      
      // Check data distribution
      const yearCounts = {};
      allEntries.forEach(entry => {
        if (entry.c_date) {
          const year = entry.c_date.substring(0, 4);
          yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
      });
      
      console.log('\n📅 Data distribution by year in fetched batches:');
      Object.entries(yearCounts)
        .sort(([a], [b]) => b.localeCompare(a))
        .forEach(([year, count]) => {
          console.log(`   ${year}: ${count} records`);
        });
    }
    
    // Step 5: Test filtering logic
    console.log('\n🧪 Step 5: Testing filtering logic');
    
    if (allEntries.length > 0) {
      // Test year filter for 2017
      const year2017Filter = allEntries.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`📅 Year 2017 filter: ${year2017Filter.length} entries`);
      
      // Test specific date filter
      const specificDateFilter = allEntries.filter(entry => 
        entry.c_date === '2017-01-21'
      );
      console.log(`📅 Date 2017-01-21 filter: ${specificDateFilter.length} entries`);
      
      if (year2017Filter.length > 0) {
        console.log('\n📋 Sample 2017 entries:');
        console.table(year2017Filter.slice(0, 3));
      }
    }
    
    console.log('\n🔍 Debug Analysis Complete!');
    console.log('💡 Key findings:');
    console.log(`   1. Total records in database: ${totalCount}`);
    console.log(`   2. Direct query returns: ${directData?.length || 0} records`);
    console.log(`   3. High limit query returns: ${highLimitData?.length || 0} records`);
    console.log(`   4. Batch approach fetched: ${allEntries.length} records`);
    
    if (totalCount > 1000 && allEntries.length < totalCount) {
      console.log('\n⚠️  ISSUE IDENTIFIED:');
      console.log('   Supabase has a hard limit that prevents fetching all records.');
      console.log('   The batch approach should work but might be hitting limits.');
      console.log('\n🔧 SOLUTION:');
      console.log('   Your app needs to use the batch approach to get all data.');
      console.log('   Check if the updated getCashBookEntries function is being called.');
    }
    
  } catch (error) {
    console.error('❌ Error during debug:', error.message);
  }
}

// Run the debug
debugAppFetch();













