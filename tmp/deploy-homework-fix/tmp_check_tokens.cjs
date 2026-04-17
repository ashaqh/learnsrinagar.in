const mysql = require('mysql2/promise');

async function checkTokens() {
    const config = {
        host: '69.62.84.118',
        user: 'learnsrinagar',
        password: 'e3iWzvZnZifgN38OiM2Q',
        database: 'learnsrinagar',
    };
    
    console.log('Connecting to:', config.host);
    const pool = mysql.createPool(config);

    try {
        const [rows] = await pool.query('SELECT * FROM device_tokens LIMIT 10');
        console.log('Device Tokens count (total):', (await pool.query('SELECT count(*) as count FROM device_tokens'))[0][0].count);
        console.log('Sample tokens:', rows.map(r => ({ user_id: r.user_id, token: r.token.substring(0, 10) + '...' })));
        
        const [users] = await pool.query('SELECT count(*) as count FROM users');
        console.log('Total users:', users[0].count);

        const [userWithTokens] = await pool.query('SELECT count(distinct user_id) as count FROM device_tokens');
        console.log('Users with tokens:', userWithTokens[0].count);

        // Check if IDs are integers or strings
        if (rows.length > 0) {
            console.log('Type of user_id in device_tokens:', typeof rows[0].user_id);
        }
        
        const [sampleUsers] = await pool.query('SELECT id FROM users LIMIT 1');
        if (sampleUsers.length > 0) {
            console.log('Type of id in users:', typeof sampleUsers[0].id);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkTokens();
