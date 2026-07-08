#!/usr/bin/env node

/**
 * CSV Import Script for Thirumala Business Management System
 * Imports CSV data into the cash_book table using batch processing
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '..', '.env');
let supabaseUrl, supabaseServiceKey;

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
  supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
}

// Fallback to hardcoded values if env not found
if (!supabaseUrl) {
  supabaseUrl = process.env.VITE_SUPABASE_URL || '';
}

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in .env file');
  console.log('📝 Please add your service role key to .env file:');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('🚀 CSV Import Script for Thirumala Business Management System');
console.log('==========================================================\n');

// SQL script for CSV import
const importScript = `
-- Step 1: Create a temporary staging table
CREATE TEMP TABLE staging_import (
    "SNo" BIGINT,
    "AccountName" TEXT,
    "SubAccount" TEXT,
    "Particulars" TEXT,
    "C_Date" TEXT,
    "Credit" NUMERIC,
    "Debit" NUMERIC,
    "Lock" BOOLEAN,
    "ID" BIGINT,
    "CompanyName" TEXT,
    "Address" TEXT,
    "STAFF" TEXT
);

-- Step 2: Copy CSV from local machine
COPY staging_import
FROM 'C:/Users/aparn/OneDrive/Desktop/updated_sample.csv'
WITH (FORMAT csv, HEADER true);

-- Step 3: Insert into cash_book in batches of 2500
DO $$
DECLARE
    batch_size INT := 2500;
    total_rows INT;
    i INT := 0;
BEGIN
    SELECT COUNT(*) INTO total_rows FROM staging_import;

    WHILE i < total_rows LOOP
        INSERT INTO cash_book (
            sno, account_name, sub_account, particulars, c_date,
            credit, debit, lock, id, company_name, address, staff
        )
        SELECT
            "SNo",
            "AccountName",
            "SubAccount",
            "Particulars",
            COALESCE(NULLIF("C_Date", '')::DATE, NOW()::DATE),
            "Credit",
            "Debit",
            "Lock",
            "ID",
            "CompanyName",
            "Address",
            "STAFF"
        FROM staging_import
        ORDER BY "SNo"
        OFFSET i LIMIT batch_size;

        i := i + batch_size;
    END LOOP;
END $$;

-- Step 4: Drop staging table
DROP TABLE staging_import;
`;

async function importCSV() {
  try {
    console.log('📊 Starting CSV import process...');
    
    // Check if CSV file exists
    const csvPath = 'C:/Users/aparn/OneDrive/Desktop/updated_sample.csv';
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found at: ${csvPath}`);
      console.log('📝 Please ensure the file exists and the path is correct');
      return;
    }
    
    console.log('✅ CSV file found');
    
    // Execute the import script
    console.log('🔄 Executing import script...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: importScript });
    
    if (error) {
      // If exec_sql function doesn't exist, try direct SQL execution
      console.log('⚠️  exec_sql function not available, trying direct SQL...');
      
      // Split the script into individual statements
      const statements = importScript
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
          
          try {
            const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });
            if (stmtError) {
              console.error(`❌ Error in statement ${i + 1}:`, stmtError);
              break;
            }
          } catch (e) {
            console.error(`❌ Failed to execute statement ${i + 1}:`, e.message);
            break;
          }
        }
      }
    } else {
      console.log('✅ Import script executed successfully');
    }
    
    console.log('\n🎉 CSV import process completed!');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    
    if (error.message.includes('exec_sql')) {
      console.log('\n💡 Alternative approach:');
      console.log('1. Go to your Supabase dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the import script');
      console.log('4. Execute it manually');
    }
  }
}

// Run the import
importCSV();

