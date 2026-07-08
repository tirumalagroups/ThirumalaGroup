import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Initialize Supabase client with hardcoded credentials from supabase.ts
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDataRange() {
  console.log('🔍 Checking current data range in database...\n');
  
  try {
    // Check cash_book date range
    const { data: cashBookData, error: cashBookError } = await supabase
      .from('cash_book')
      .select('c_date')
      .order('c_date', { ascending: true })
      .limit(1);
    
    if (cashBookError) {
      console.error('❌ Error checking cash_book dates:', cashBookError);
      return;
    }
    
    const { data: latestData, error: latestError } = await supabase
      .from('cash_book')
      .select('c_date')
      .order('c_date', { ascending: false })
      .limit(1);
    
    if (latestError) {
      console.error('❌ Error checking latest cash_book dates:', latestError);
      return;
    }
    
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting total count:', countError);
      return;
    }
    
    console.log('📊 Current Data Range:');
    console.log(`   Earliest date: ${cashBookData[0]?.c_date || 'No data'}`);
    console.log(`   Latest date: ${latestData[0]?.c_date || 'No data'}`);
    console.log(`   Total records: ${totalCount || 0}`);
    
    // Check how many records are before 2025-10-03
    const cutoffDate = '2025-10-03';
    const { count: oldRecordsCount, error: oldRecordsError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true })
      .lt('c_date', cutoffDate);
    
    if (oldRecordsError) {
      console.error('❌ Error checking old records:', oldRecordsError);
      return;
    }
    
    console.log(`\n🗑️  Records before ${cutoffDate}: ${oldRecordsCount || 0}`);
    
    if (oldRecordsCount > 0) {
      console.log(`\n⚠️  Found ${oldRecordsCount} records that need to be cleaned up for better performance.`);
      console.log('💡 Run this script with --cleanup flag to remove old data.');
    } else {
      console.log('\n✅ No old data found. Database is already optimized!');
    }
    
  } catch (error) {
    console.error('❌ Error checking data range:', error.message);
  }
}

async function cleanupOldData() {
  console.log('🗑️  Starting cleanup of data before 2025-10-03...\n');
  
  const cutoffDate = '2025-10-03';
  
  try {
    // First, check how many records will be deleted
    const { count: oldRecordsCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true })
      .lt('c_date', cutoffDate);
    
    if (countError) {
      console.error('❌ Error checking old records count:', countError);
      return;
    }
    
    if (oldRecordsCount === 0) {
      console.log('✅ No old data found. Database is already clean!');
      return;
    }
    
    console.log(`⚠️  About to delete ${oldRecordsCount} records before ${cutoffDate}`);
    console.log('This action cannot be undone!');
    
    // Delete old cash_book entries
    console.log('\n1️⃣  Deleting old cash_book entries...');
    const { error: cashBookError } = await supabase
      .from('cash_book')
      .delete()
      .lt('c_date', cutoffDate);
    
    if (cashBookError) {
      console.error('❌ Error deleting old cash_book entries:', cashBookError);
      return;
    }
    
    console.log('✅ Old cash_book entries deleted');
    
    // Delete old deleted_cash_book entries
    console.log('\n2️⃣  Deleting old deleted_cash_book entries...');
    const { error: deletedError } = await supabase
      .from('deleted_cash_book')
      .delete()
      .lt('c_date', cutoffDate);
    
    if (deletedError) {
      console.error('❌ Error deleting old deleted_cash_book entries:', deletedError);
    } else {
      console.log('✅ Old deleted_cash_book entries deleted');
    }
    
    // Delete old edit_cash_book entries
    console.log('\n3️⃣  Deleting old edit_cash_book entries...');
    const { error: editError } = await supabase
      .from('edit_cash_book')
      .delete()
      .lt('c_date', cutoffDate);
    
    if (editError) {
      console.error('❌ Error deleting old edit_cash_book entries:', editError);
    } else {
      console.log('✅ Old edit_cash_book entries deleted');
    }
    
    // Verify cleanup
    console.log('\n4️⃣  Verifying cleanup...');
    const { count: remainingOldRecords, error: verifyError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true })
      .lt('c_date', cutoffDate);
    
    if (verifyError) {
      console.error('❌ Error verifying cleanup:', verifyError);
      return;
    }
    
    if (remainingOldRecords === 0) {
      console.log('✅ Cleanup completed successfully!');
      console.log('🚀 Database is now optimized for better performance.');
    } else {
      console.log(`⚠️  ${remainingOldRecords} old records still remain.`);
    }
    
    // Show new data range
    const { data: newEarliestData, error: newEarliestError } = await supabase
      .from('cash_book')
      .select('c_date')
      .order('c_date', { ascending: true })
      .limit(1);
    
    if (!newEarliestError && newEarliestData.length > 0) {
      console.log(`\n📊 New earliest date: ${newEarliestData[0].c_date}`);
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--cleanup')) {
    await cleanupOldData();
  } else {
    await checkDataRange();
    console.log('\n💡 To clean up old data, run: node scripts/cleanup-old-data.js --cleanup');
  }
}

main();
