import { query } from './src/lib/db.js';

async function test() {
    try {
        console.log('Testing LOCAL database connection...');
        const results = await query('SELECT 1 as test');
        console.log('Connection successful:', results);
        process.exit(0);
    } catch (error) {
        console.error('Connection failed:', error);
        process.exit(1);
    }
}

test();
