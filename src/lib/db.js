import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST ?? '69.62.84.118',
    user: process.env.DB_USER ?? 'learnsrinagar',
    password: process.env.DB_PASSWORD ?? 'e3iWzvZnZifgN38OiM2Q',
    database: process.env.DB_NAME ?? 'learnsrinagar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
});

// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     database: 'learnsrinagar',
//     password: '',
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
// });

export async function query(sql, params = []) {
    try {
        const connection = await pool.getConnection();
        try {
            const [results] = await connection.query(sql, params);
            return results;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

export const db = { query };