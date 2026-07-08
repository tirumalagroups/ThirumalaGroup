#!/usr/bin/env node

/**
 * Test Batch Fetching Script
 * Tests the batch fetching logic specifically to see where it fails
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

console.log('🧪 Test Batch Fetching Script for Thirumala Business Management System');
console.log('=====================================================================\n');

async function testBatchFetching() {
  try {
    console.log('🔍 Testing batch fetching logic step by step...\n');
    
    // Step 1: Get total count
    console.log('📊 Step 1: Getting total count');
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Count query failed:', countError.message);
      return;
    }
    console.log(`✅ Total records in database: ${totalCount}\n`);
    
    // Step 2: Test individual batch queries
    console.log('📊 Step 2: Testing individual batch queries');
    
    const batchSize = 1000;
    const testBatches = 5; // Test first 5 batches
    
    for (let i = 0; i < testBatches; i++) {
      const offset = i * batchSize;
      console.log(`\n🔄 Testing batch ${i + 1} (offset ${offset} to ${offset + batchSize - 1})`);
      
      const { data: batchData, error: batchError } = await supabase
        .from('cash_book')
        .select('id, sno, acc_name, particulars, c_date, company_name')
        .order('c_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        console.error(`   ❌ Batch ${i + 1} failed: ${batchError.message}`);
        continue;
      }

      if (batchData) {
        console.log(`   ✅ Batch ${i + 1} successful: ${batchData.length} records`);
        
        // Check for 2017 data in this batch
        const data2017 = batchData.filter(entry => 
          entry.c_date && entry.c_date.startsWith('2017')
        );
        console.log(`   📅 2017 data in batch ${i + 1}: ${data2017.length} records`);
        
        if (data2017.length > 0) {
          console.log('   📋 Sample 2017 records from this batch:');
          console.table(data2017.slice(0, 2));
        }
        
        // Check year distribution in this batch
        const yearCounts = {};
        batchData.forEach(entry => {
          if (entry.c_date) {
            const year = entry.c_date.substring(0, 4);
            yearCounts[year] = (yearCounts[year] || 0) + 1;
          }
        });
        
        console.log('   📅 Year distribution in this batch:');
        Object.entries(yearCounts)
          .sort(([a], [b]) => b.localeCompare(a))
          .forEach(([year, count]) => {
            console.log(`     ${year}: ${count} records`);
          });
      }
      
      // Small delay between batches
      if (i < testBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Step 3: Test specific range queries to find 2017 data
    console.log('\n📊 Step 3: Testing specific range queries to find 2017 data');
    
    // Try different ranges to find where 2017 data might be
    const ranges = [
      { start: 10000, end: 19999, name: 'Range 10k-20k' },
      { start: 50000, end: 59999, name: 'Range 50k-60k' },
      { start: 100000, end: 109999, name: 'Range 100k-110k' },
      { start: 200000, end: 209999, name: 'Range 200k-210k' },
      { start: 400000, end: 409999, name: 'Range 400k-410k' }
    ];
    
    for (const range of ranges) {
      console.log(`\n🔍 Testing ${range.name} (offset ${range.start} to ${range.end})`);
      
      const { data: rangeData, error: rangeError } = await supabase
        .from('cash_book')
        .select('id, sno, acc_name, particulars, c_date, company_name')
        .order('c_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(range.start, range.end);

      if (rangeError) {
        console.error(`   ❌ ${range.name} failed: ${rangeError.message}`);
        continue;
      }

      if (rangeData && rangeData.length > 0) {
        console.log(`   ✅ ${range.name} successful: ${rangeData.length} records`);
        
        // Check for 2017 data
        const data2017 = rangeData.filter(entry => 
          entry.c_date && entry.c_date.startsWith('2017')
        );
        console.log(`   📅 2017 data in ${range.name}: ${data2017.length} records`);
        
        if (data2017.length > 0) {
          console.log('   📋 Found 2017 data! Sample records:');
          console.table(data2017.slice(0, 3));
          break; // Found 2017 data, no need to check other ranges
        }
      }
      
      // Small delay between ranges
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log('\n✅ Batch fetching test complete!');
    console.log('💡 This test shows where your 2017 data is located.');
    console.log('💡 Your app should use this batch approach to get all data.');
    
  } catch (error) {
    console.error('❌ Error during batch fetching test:', error.message);
  }
}

// Run the test
testBatchFetching();













