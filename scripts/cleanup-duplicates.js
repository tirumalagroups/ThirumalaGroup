#!/usr/bin/env node

/**
 * Duplicate Cleanup Script for Thirumala Business Management System
 * Removes duplicate records before running a fresh import
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

console.log('🧹 Duplicate Cleanup Script for Thirumala Business Management System');
console.log('==================================================================\n');

async function cleanupDuplicates() {
  try {
    console.log('⚠️  WARNING: This will delete ALL data from cash_book table!');
    console.log('   This action cannot be undone.\n');
    
    // Get current count
    const { count: currentCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting current count:', countError.message);
      return;
    }
    
    console.log(`📊 Current records in cash_book: ${currentCount}`);
    
    // Ask for confirmation
    console.log('\n🔴 To proceed with cleanup, please type "YES" to confirm:');
    
    // For safety, we'll just show what would be deleted
    console.log('\n📋 Records that would be deleted:');
    console.log(`   - All ${currentCount} records from cash_book table`);
    console.log(`   - All companies (will be re-imported)`);
    
    console.log('\n💡 RECOMMENDATION:');
    console.log('   1. Backup your data first if needed');
    console.log('   2. Run this cleanup script');
    console.log('   3. Run the corrected import script');
    
    // For now, just show the cleanup SQL without executing
    console.log('\n🔧 Cleanup SQL (run manually in Supabase SQL Editor):');
    console.log('```sql');
    console.log('-- Clean up all data');
    console.log('DELETE FROM cash_book;');
    console.log('DELETE FROM companies;');
    console.log('');
    console.log('-- Reset auto-increment counters');
    console.log('ALTER SEQUENCE cash_book_sno_seq RESTART WITH 1;');
    console.log('```');
    
    console.log('\n📝 Next steps:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Run the cleanup SQL above');
    console.log('   4. Come back and run the corrected import script');
    
  } catch (error) {
    console.error('❌ Error during cleanup analysis:', error.message);
  }
}

// Run the cleanup analysis
cleanupDuplicates();

