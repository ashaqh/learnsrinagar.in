import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'learnsrinagar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
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

export async function transaction(callback) {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const queryWrapper = async (sql, params = []) => {
            const [results] = await connection.query(sql, params);
            return results;
        };
        const result = await callback(queryWrapper);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        console.error('Database transaction error:', error);
        throw error;
    } finally {
        connection.release();
    }
}

export const db = { query, transaction };