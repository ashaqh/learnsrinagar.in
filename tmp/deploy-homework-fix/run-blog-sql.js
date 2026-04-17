import fs from 'fs';
import mysql from 'mysql2/promise';

async function runBlogSQL() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '69.62.84.118',
        user: process.env.DB_USER || 'learnsrinagar',
        database: process.env.DB_NAME || 'learnsrinagar',
        password: process.env.DB_PASSWORD || 'e3iWzvZnZifgN38OiM2Q',
        multipleStatements: true
    });
    
    try {
        const sqlContent = fs.readFileSync('./SQL changes/blog.sql', 'utf8');
        const statements = sqlContent.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
            if (statement.trim() && !statement.includes('LOCK TABLES') && !statement.includes('UNLOCK TABLES')) {
                await connection.query(statement);
            }
        }
        console.log('Blog tables created successfully!');
    } catch (error) {
        console.error('Error creating blog tables:', error);
    } finally {
        await connection.end();
    }
}

runBlogSQL();