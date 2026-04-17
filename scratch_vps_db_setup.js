import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function setup() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    // Using debian-sys-maint credentials found in /etc/mysql/debian.cnf
    const dbUser = 'debian-sys-maint';
    const dbPass = 'gjpa5XOYUcCpq71W';

    console.log("Setting up local database using debian-sys-maint...");
    const setupSql = `CREATE DATABASE IF NOT EXISTS learnsrinagar; 
                     CREATE USER IF NOT EXISTS 'learnsrinagar'@'localhost' IDENTIFIED BY 'e3iWzvZnZifgN38OiM2Q'; 
                     GRANT ALL PRIVILEGES ON learnsrinagar.* TO 'learnsrinagar'@'localhost'; 
                     FLUSH PRIVILEGES;`;
    
    // Writing setup SQL to a temporary file on the VPS
    await ssh.execCommand(`echo "${setupSql}" > /tmp/setup.sql`);
    let res = await ssh.execCommand(`mysql -u ${dbUser} -p${dbPass} < /tmp/setup.sql`);
    console.log("Setup Output:", res.stdout || res.stderr || "Success");

    console.log("Importing learnsrinagar.sql...");
    res = await ssh.execCommand(`mysql -u ${dbUser} -p${dbPass} learnsrinagar < /var/www/learnsrinagar.in/learnsrinagar.sql`);
    console.log("Import Output:", res.stdout || res.stderr || "Success");

    ssh.dispose();
  } catch (err) {
    console.error("Setup Error:", err);
    process.exit(1);
  }
}

setup();
