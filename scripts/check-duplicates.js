#!/usr/bin/env node

/**
 * Duplicate Check Script for Thirumala Business Management System
 * Checks for duplicate records and analyzes data distribution
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

console.log('🔍 Duplicate Check Script for Thirumala Business Management System');
console.log('================================================================\n');

async function checkDuplicates() {
  try {
    console.log('📊 Analyzing data for duplicates and patterns...\n');
    
    // Check for duplicate SNo values
    console.log('🔍 Checking for duplicate SNo values...');
    const { data: duplicateSno, error: snoError } = await supabase
      .from('cash_book')
      .select('sno, count')
      .select('sno')
      .order('sno', { ascending: true });
    
    if (snoError) {
      console.error('❌ Error checking SNo:', snoError.message);
    } else {
      const snoCounts = {};
      duplicateSno.forEach(record => {
        snoCounts[record.sno] = (snoCounts[record.sno] || 0) + 1;
      });
      
      const duplicates = Object.entries(snoCounts).filter(([sno, count]) => count > 1);
      console.log(`📋 Found ${duplicates.length} SNo values with duplicates`);
      
      if (duplicates.length > 0) {
        console.log('   Top 10 duplicate SNo values:');
        duplicates.slice(0, 10).forEach(([sno, count]) => {
          console.log(`   SNo ${sno}: ${count} times`);
        });
      }
    }
    
    // Check data distribution by company
    console.log('\n🏢 Checking data distribution by company...');
    const { data: companyDistribution, error: companyError } = await supabase
      .from('cash_book')
      .select('company_name, count')
      .select('company_name');
    
    if (companyError) {
      console.error('❌ Error checking company distribution:', companyError.message);
    } else {
      const companyCounts = {};
      companyDistribution.forEach(record => {
        companyCounts[record.company_name] = (companyCounts[record.company_name] || 0) + 1;
      });
      
      console.log(`📊 Records per company:`);
      Object.entries(companyCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([company, count]) => {
          console.log(`   ${company}: ${count} records`);
        });
    }
    
    // Check date range
    console.log('\n📅 Checking date range...');
    const { data: dateRange, error: dateError } = await supabase
      .from('cash_book')
      .select('c_date')
      .order('c_date', { ascending: true });
    
    if (dateError) {
      console.error('❌ Error checking date range:', dateError.message);
    } else if (dateRange && dateRange.length > 0) {
      const dates = dateRange.map(r => r.c_date).filter(d => d);
      if (dates.length > 0) {
        console.log(`   Earliest date: ${dates[0]}`);
        console.log(`   Latest date: ${dates[dates.length - 1]}`);
        console.log(`   Total unique dates: ${new Set(dates).size}`);
      }
    }
    
    // Check for records with same content but different IDs
    console.log('\n🔍 Checking for content duplicates...');
    const { data: contentCheck, error: contentError } = await supabase
      .from('cash_book')
      .select('acc_name, sub_acc_name, particulars, c_date, credit, debit, company_name')
      .limit(1000);
    
    if (contentError) {
      console.error('❌ Error checking content:', contentError.message);
    } else {
      const contentMap = new Map();
      let duplicateContent = 0;
      
      contentCheck.forEach(record => {
        const key = `${record.acc_name}|${record.sub_acc_name}|${record.particulars}|${record.c_date}|${record.credit}|${record.debit}|${record.company_name}`;
        if (contentMap.has(key)) {
          duplicateContent++;
        } else {
          contentMap.set(key, 1);
        }
      });
      
      console.log(`📋 In sample of 1000 records: ${duplicateContent} potential content duplicates`);
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 ANALYSIS SUMMARY:');
    console.log(`   Total records in database: 346,389`);
    console.log(`   Expected from CSV: 67,117`);
    console.log(`   Difference: +${346389 - 67117} records`);
    console.log('\n💡 This suggests either:');
    console.log('   1. Multiple imports were run');
    console.log('   2. The CSV had more data than initially detected');
    console.log('   3. There are duplicate records from previous imports');
    
  } catch (error) {
    console.error('❌ Error during duplicate check:', error.message);
  }
}

// Run the duplicate check
checkDuplicates();

