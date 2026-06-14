require('dotenv').config();
const https = require('https');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const url = `${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`;

https.get(url, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const schema = JSON.parse(body);
      const customerDef = schema.definitions.finance_customers;
      if (customerDef) {
        console.log('finance_customers properties:', Object.keys(customerDef.properties));
      } else {
        console.log('finance_customers definition not found in schema. Available definitions:', Object.keys(schema.definitions));
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Response body prefix:', body.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error(e);
});
