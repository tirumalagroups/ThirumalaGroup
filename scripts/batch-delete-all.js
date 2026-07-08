#!/usr/bin/env node

/**
 * Batch Delete All Data Script
 * This script will delete ALL data from your database in small batches
 * to avoid timeouts
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

console.log('🗑️  BATCH DELETE ALL DATA SCRIPT');
console.log('=================================\n');
console.log('⚠️  WARNING: This will delete ALL data from your database!');
console.log('⚠️  This action cannot be undone!\n');

// Function to delete data in batches
async function deleteTableInBatches(tableName, batchSize = 1000) {
  try {
    console.log(`🗑️  Deleting all records from ${tableName} in batches of ${batchSize}...`);
    
    let totalDeleted = 0;
    let batchCount = 0;
    
    while (true) {
      batchCount++;
      
      // Get a batch of IDs to delete
      const { data: batchData, error: selectError } = await supabase
        .from(tableName)
        .select('id')
        .limit(batchSize);
      
      if (selectError) {
        console.error(`❌ Error selecting batch ${batchCount} from ${tableName}:`, selectError.message);
        break;
      }
      
      if (!batchData || batchData.length === 0) {
        console.log(`   ✅ No more records to delete from ${tableName}`);
        break;
      }
      
      // Extract IDs from the batch
      const idsToDelete = batchData.map(record => record.id);
      
      // Delete the batch
      const { error: deleteError } = await supabase
        .from(tableName)
        .delete()
        .in('id', idsToDelete);
      
      if (deleteError) {
        console.error(`❌ Error deleting batch ${batchCount} from ${tableName}:`, deleteError.message);
        break;
      }
      
      totalDeleted += batchData.length;
      console.log(`   ✅ Batch ${batchCount}: Deleted ${batchData.length} records (Total: ${totalDeleted})`);
      
      // Add delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`✅ Successfully deleted ${totalDeleted} records from ${tableName}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Exception deleting from ${tableName}:`, error.message);
    return false;
  }
}

// Function to verify cleanup
async function verifyCleanup() {
  try {
    console.log('\n🔍 Verifying cleanup...');
    
    // Check cash_book
    const { count: cashBookCount, error: cashBookError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (cashBookError) {
      console.error('❌ Error checking cash_book count:', cashBookError.message);
    } else {
      console.log(`💰 Cash Book records: ${cashBookCount || 0}`);
    }
    
    // Check companies
    const { count: companiesCount, error: companiesError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (companiesError) {
      console.error('❌ Error checking companies count:', companiesError.message);
    } else {
      console.log(`🏢 Companies: ${companiesCount || 0}`);
    }
    
    // Check company_main_accounts
    const { count: mainAccCount, error: mainAccError } = await supabase
      .from('company_main_accounts')
      .select('*', { count: 'exact', head: true });
    
    if (mainAccError) {
      console.error('❌ Error checking main accounts count:', mainAccError.message);
    } else {
      console.log(`📋 Main Accounts: ${mainAccCount || 0}`);
    }
    
    // Check company_main_sub_acc
    const { count: subAccCount, error: subAccError } = await supabase
      .from('company_main_sub_acc')
      .select('*', { count: 'exact', head: true });
    
    if (subAccError) {
      console.error('❌ Error checking sub accounts count:', subAccError.message);
    } else {
      console.log(`📝 Sub Accounts: ${subAccCount || 0}`);
    }
    
    const totalRecords = (cashBookCount || 0) + (companiesCount || 0) + (mainAccCount || 0) + (subAccCount || 0);
    
    if (totalRecords === 0) {
      console.log('\n🎉 SUCCESS: All data has been deleted!');
      console.log('✅ Database is now completely empty');
    } else {
      console.log('\n⚠️  WARNING: Some data still exists!');
      console.log(`📊 Total remaining records: ${totalRecords}`);
    }
    
    return totalRecords === 0;
  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    return false;
  }
}

// Main cleanup function
async function performCleanup() {
  try {
    console.log('🚀 Starting complete data cleanup in batches...\n');
    
    // Delete from all tables in correct order (respecting foreign keys)
    const tables = [
      'cash_book',
      'company_main_sub_acc', 
      'company_main_accounts',
      'companies'
    ];
    
    let successCount = 0;
    for (const table of tables) {
      const success = await deleteTableInBatches(table, 500); // Smaller batch size
      if (success) successCount++;
      
      // Add delay between tables
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 Cleanup Summary: ${successCount}/${tables.length} tables cleaned`);
    
    // Verify cleanup
    const isClean = await verifyCleanup();
    
    if (isClean) {
      console.log('\n🎯 READY FOR FRESH IMPORT!');
      console.log('🚀 You can now run: node scripts/import-csv-complete.js');
    } else {
      console.log('\n⚠️  Some cleanup issues detected');
      console.log('💡 You may need to manually clean up remaining data');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Run the cleanup
performCleanup();













