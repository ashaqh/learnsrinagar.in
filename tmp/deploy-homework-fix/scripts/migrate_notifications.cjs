const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'learnsrinagar',
});

async function migrate() {
    try {
        console.log('Starting migration...');
        const sqlPath = path.join(__dirname, '..', 'SQL changes', 'notifications_migration.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Split by semicolon but ignore semicolons within comments or strings (simplistic split)
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const connection = await pool.getConnection();
        try {
            for (const statement of statements) {
                console.log(`Executing: ${statement.substring(0, 50)}...`);
                await connection.query(statement);
            }
            console.log('Migration completed successfully!');
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
