import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testConnection() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'learnsrinagar',
    };
    
    console.log('Testing connection with config:', { ...config, password: '***' });
    
    try {
        const connection = await mysql.createConnection(config);
        console.log('SUCCESS: Connection established.');
        await connection.end();
    } catch (err) {
        console.error('FAILURE: Could not connect to database.');
        console.error(err);
    }
}

testConnection();
