#!/usr/bin/env node

/**
 * Direct CSV Import Script for Thirumala Business Management System
 * Reads local CSV file and inserts data via Supabase API
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

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
  console.log('📝 Please add your anon key to .env file:');
  console.log('   VITE_SUPABASE_ANON_KEY=your_anon_key_here');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🚀 Direct CSV Import Script for Thirumala Business Management System');
console.log('================================================================\n');

const csvPath = 'C:/Users/aparn/OneDrive/Desktop/updated_sample.csv';
const batchSize = 2500;

// Helper function to parse dates safely
function parseDate(dateString) {
  try {
    // Handle the format "2025-07-03 00:00:00"
    if (dateString && dateString.trim()) {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.warn(`⚠️  Could not parse date: ${dateString}, using current date`);
    return new Date().toISOString().split('T')[0];
  }
}

async function readCSVFile() {
  return new Promise((resolve, reject) => {
    const results = [];
    
    if (!fs.existsSync(csvPath)) {
      reject(new Error(`CSV file not found at: ${csvPath}`));
      return;
    }
    
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        // Clean and transform the data based on actual CSV structure and DB schema
        const cleanData = {
          sno: results.length + 1, // Generate sequential SNo since it's not in CSV
          acc_name: data['Main Account'] || '',
          sub_acc_name: data['Sub Account'] || '',
          particulars: data.Particulars || '',
          c_date: parseDate(data.Date),
          credit: parseFloat(data.Credit) || 0,
          debit: parseFloat(data.Debit) || 0,
          credit_online: parseFloat(data['Credit Online']) || 0,
          credit_offline: parseFloat(data['Credit Offline']) || 0,
          debit_online: parseFloat(data['Debit Online']) || 0,
          debit_offline: parseFloat(data['Debit Offline']) || 0,
          lock_record: false, // Default value since Lock column doesn't exist
          company_name: data.Company || '',
          address: data.Address || '',
          staff: data.Staff || '',
          sale_qty: parseFloat(data['Sale Qty']) || 0,
          purchase_qty: parseFloat(data['Purchase Qty']) || 0,
          approved: false, // Default value
          edited: false, // Default value
          e_count: 0, // Default value
          cb: '', // Default value
          users: '', // Default value
          entry_time: new Date().toISOString()
        };
        
        // Filter out rows with invalid data
        if (cleanData.acc_name && cleanData.particulars) {
          results.push(cleanData);
        }
      })
      .on('end', () => {
        console.log(`✅ CSV file read successfully. Found ${results.length} valid rows.`);
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

async function insertBatch(data, batchNumber) {
  try {
    const { data: result, error } = await supabase
      .from('cash_book')
      .insert(data)
      .select();
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Batch ${batchNumber}: Inserted ${data.length} records`);
    return result;
  } catch (error) {
    console.error(`❌ Batch ${batchNumber} failed:`, error.message);
    throw error;
  }
}

async function importCSV() {
  try {
    console.log('📊 Starting CSV import process...');
    
    // Read CSV file
    const csvData = await readCSVFile();
    
    if (csvData.length === 0) {
      console.log('⚠️  No valid data found in CSV file');
      return;
    }
    
    // Process data in batches
    const totalBatches = Math.ceil(csvData.length / batchSize);
    console.log(`🔄 Processing ${csvData.length} records in ${totalBatches} batches...`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      try {
        await insertBatch(batch, batchNumber);
        successCount += batch.length;
      } catch (error) {
        errorCount += batch.length;
        console.error(`❌ Failed to insert batch ${batchNumber}`);
        
        // Continue with next batch instead of stopping
        continue;
      }
      
      // Add a small delay between batches to avoid overwhelming the database
      if (i + batchSize < csvData.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n🎉 CSV import process completed!');
    console.log(`📊 Summary:`);
    console.log(`   ✅ Successfully inserted: ${successCount} records`);
    console.log(`   ❌ Failed to insert: ${errorCount} records`);
    console.log(`   📁 Total processed: ${csvData.length} records`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
  }
}

// Run the import
importCSV();

