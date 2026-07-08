#!/usr/bin/env node

/**
 * Check Recent Data Script for Thirumala Business Management System
 * Verifies recent entries and data visibility
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

console.log('🔍 Recent Data Check Script for Thirumala Business Management System');
console.log('==================================================================\n');

async function checkRecentData() {
  try {
    console.log('📊 Checking recent data entries...\n');
    
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('cash_book')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting total count:', countError.message);
      return;
    }
    
    console.log(`📈 Total records in database: ${totalCount}`);
    
    // Get most recent entries by created_at
    console.log('\n🕒 Most recent entries (by created_at):');
    const { data: recentByCreated, error: recentError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, sub_acc_name, particulars, c_date, credit, debit, company_name, created_at, entry_time')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentError) {
      console.error('❌ Error getting recent entries:', recentError.message);
    } else {
      console.table(recentByCreated);
    }
    
    // Get entries by entry_time
    console.log('\n🕒 Most recent entries (by entry_time):');
    const { data: recentByEntryTime, error: entryTimeError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, sub_acc_name, particulars, c_date, credit, debit, company_name, created_at, entry_time')
      .order('entry_time', { ascending: false })
      .limit(10);
    
    if (entryTimeError) {
      console.error('❌ Error getting entries by entry_time:', entryTimeError.message);
    } else {
      console.table(recentByEntryTime);
    }
    
    // Check for entries with today's date
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📅 Entries with today's date (${today}):`);
    const { data: todayEntries, error: todayError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name')
      .eq('c_date', today)
      .limit(10);
    
    if (todayError) {
      console.error('❌ Error getting today\'s entries:', todayError.message);
    } else {
      if (todayEntries && todayEntries.length > 0) {
        console.table(todayEntries);
        console.log(`✅ Found ${todayEntries.length} entries for today`);
      } else {
        console.log('❌ No entries found for today');
      }
    }
    
    // Check for entries with recent dates (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    
    console.log(`\n📅 Entries from last 7 days (${weekAgoStr} to ${today}):`);
    const { data: weekEntries, error: weekError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name')
      .gte('c_date', weekAgoStr)
      .lte('c_date', today)
      .order('c_date', { ascending: false })
      .limit(20);
    
    if (weekError) {
      console.error('❌ Error getting week entries:', weekError.message);
    } else {
      if (weekEntries && weekEntries.length > 0) {
        console.table(weekEntries);
        console.log(`✅ Found ${weekEntries.length} entries from last 7 days`);
      } else {
        console.log('❌ No entries found from last 7 days');
      }
    }
    
    // Check for specific company entries
    console.log('\n🏢 Sample entries for specific companies:');
    const { data: companyEntries, error: companyError } = await supabase
      .from('cash_book')
      .select('id, sno, acc_name, particulars, c_date, credit, debit, company_name')
      .in('company_name', ['BR AND BVT', 'BUKKA SAI VIVEK A/C'])
      .order('c_date', { ascending: false })
      .limit(10);
    
    if (companyError) {
      console.error('❌ Error getting company entries:', companyError.message);
    } else {
      if (companyEntries && companyEntries.length > 0) {
        console.table(companyEntries);
      } else {
        console.log('❌ No company entries found');
      }
    }
    
    console.log('\n🔍 Data Visibility Check Complete!');
    
  } catch (error) {
    console.error('❌ Error during data check:', error.message);
  }
}

// Run the check
checkRecentData();

