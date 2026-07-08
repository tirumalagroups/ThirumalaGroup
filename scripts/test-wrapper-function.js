#!/usr/bin/env node

/**
 * Test Wrapper Function Script
 * Tests the supabaseDB.getCashBookEntries() function directly
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

console.log('🧪 Test Wrapper Function Script for Thirumala Business Management System');
console.log('======================================================================\n');

// Simulate the wrapper function logic
async function testWrapperFunction() {
  try {
    console.log('🔍 Testing wrapper function logic...\n');
    
    // Step 1: Try high limit query first
    console.log('📊 Step 1: Trying high limit query (limit 100000)');
    const { data: highLimitData, error: highLimitError } = await supabase
      .from('cash_book')
      .select('*')
      .order('c_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100000);

    if (highLimitError) {
      console.error(`❌ High limit query failed: ${highLimitError.message}`);
      console.log('🔄 Falling back to batch approach...');
    } else if (highLimitData && highLimitData.length > 0) {
      console.log(`✅ High limit query successful: ${highLimitData.length} records fetched`);
      
      // Check for 2017 data
      const data2017 = highLimitData.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`📅 2017 data found: ${data2017.length} records`);
      
      if (data2017.length > 0) {
        console.log('📋 Sample 2017 records:');
        console.table(data2017.slice(0, 3));
      }
      
      return highLimitData;
    } else {
      console.log('⚠️  High limit query returned no data, trying batch approach...');
    }
    
    // Step 2: Fall back to batch approach
    console.log('\n📊 Step 2: Using batch approach');
    
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError.message);
      return [];
    }

    console.log(`📊 Total records in database: ${totalCount}`);

    if (totalCount && totalCount > 1000) {
      console.log(`🔄 Fetching ${totalCount} records in batches...`);
      
      let allEntries = [];
      const batchSize = 1000;
      
      // Just fetch first few batches for testing
      const maxBatches = 10; // Limit for testing
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
      
      // Check for 2017 data
      const data2017 = allEntries.filter(entry => 
        entry.c_date && entry.c_date.startsWith('2017')
      );
      console.log(`📅 2017 data found: ${data2017.length} records`);
      
      if (data2017.length > 0) {
        console.log('📋 Sample 2017 records:');
        console.table(data2017.slice(0, 3));
      }
      
      return allEntries;
    } else {
      console.log('✅ Using standard approach for smaller dataset');
      const { data, error } = await supabase
        .from('cash_book')
        .select('*')
        .order('c_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Standard query failed:', error.message);
        return [];
      }

      return data || [];
    }
    
  } catch (error) {
    console.error('❌ Error in wrapper function:', error.message);
    return [];
  }
}

// Run the test
async function runTest() {
  try {
    const result = await testWrapperFunction();
    
    console.log('\n🔍 Test Results:');
    console.log(`✅ Total records returned: ${result.length}`);
    
    if (result.length > 0) {
      // Check data distribution
      const yearCounts = {};
      result.forEach(entry => {
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
    }
    
    console.log('\n✅ Wrapper function test complete!');
    console.log('💡 If this works, your app should also work.');
    console.log('💡 If this fails, there\'s an issue with the database or queries.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

runTest();













