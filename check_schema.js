import { query } from './src/lib/db.js';

async function check() {
  try {
    const results = await query('DESCRIBE blog_categories');
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
