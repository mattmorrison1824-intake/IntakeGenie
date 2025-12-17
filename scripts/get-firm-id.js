/**
 * Helper script to get firm ID from Supabase
 * Usage: node scripts/get-firm-id.js <user-email>
 */

// Load env vars manually
const fs = require('fs');
const path = require('path');

try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  // .env.local might not exist, that's okay
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.log('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getFirmId(userEmail) {
  try {
    // First get the user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError);
      return null;
    }

    const user = users.users.find(u => u.email === userEmail);
    if (!user) {
      console.error(`❌ User with email ${userEmail} not found`);
      return null;
    }

    // Get firm for this user
    const { data: firms, error: firmError } = await supabase
      .from('firms')
      .select('id, firm_name')
      .eq('owner_user_id', user.id)
      .limit(1)
      .single();

    if (firmError || !firms) {
      console.error('❌ Error fetching firm:', firmError);
      return null;
    }

    console.log(`✅ Found firm: ${firms.firm_name}`);
    console.log(`   Firm ID: ${firms.id}`);
    return firms.id;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

const userEmail = process.argv[2];
if (!userEmail) {
  console.error('❌ Error: Please provide user email');
  console.log('Usage: node scripts/get-firm-id.js <user-email>');
  process.exit(1);
}

getFirmId(userEmail).then((firmId) => {
  if (firmId) {
    console.log(`\n📋 Use this firm ID for testing:`);
    console.log(`   ${firmId}`);
    process.exit(0);
  } else {
    process.exit(1);
  }
});

