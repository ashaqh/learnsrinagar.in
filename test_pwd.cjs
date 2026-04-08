const bcrypt = require('bcryptjs');

async function test() {
    const hash = "$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi";
    const passwords = ['password', '123456', 'admin', 'test', '12345678'];
    for (let p of passwords) {
        const matches = await bcrypt.compare(p, hash);
        console.log(`${p}: ${matches}`);
    }
}
test();
