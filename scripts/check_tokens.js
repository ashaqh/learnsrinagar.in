import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkTokens() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'learnsrinagar',
    };
    
    try {
        const connection = await mysql.createConnection(config);
        const [rows] = await connection.query('SELECT * FROM device_tokens');
        console.log('Total tokens in database:', rows.length);
        console.log(JSON.stringify(rows, null, 2));
        
        const [users] = await connection.query('SELECT id, email FROM users LIMIT 5');
        console.log('Sample users:', JSON.stringify(users, null, 2));
        
        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkTokens();
