
import { query } from '../src/lib/db.js';

async function check() {
  try {
    const tokens = await query('SELECT * FROM device_tokens LIMIT 10');
    console.log('Recent Device Tokens:', JSON.stringify(tokens, null, 2));
    
    const count = await query('SELECT COUNT(*) as count FROM device_tokens');
    console.log('Total Tokens:', count[0].count);

    const userCount = await query('SELECT COUNT(DISTINCT user_id) as count FROM device_tokens');
    console.log('Users with Tokens:', userCount[0].count);

  } catch (error) {
    console.error('Check failed:', error);
  }
  process.exit();
}

check();
