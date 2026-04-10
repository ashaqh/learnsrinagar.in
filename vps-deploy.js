import { NodeSSH } from 'node-ssh';
import fs from 'fs';

const ssh = new NodeSSH();

async function deploy() {
  try {
    console.log("Connecting to VPS...");
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });
    console.log("Connected!");
    
    console.log("Setting up database user...");
    await ssh.execCommand('mysql -e "CREATE USER IF NOT EXISTS \'learnsrinagar\'@\'localhost\' IDENTIFIED BY \'e3iWzvZnZifgN38OiM2Q\'; GRANT ALL PRIVILEGES ON learnsrinagar.* TO \'learnsrinagar\'@\'localhost\'; FLUSH PRIVILEGES;"');
    
    console.log("Updating .env file...");
    await ssh.execCommand('sed -i "s/DB_USER=.*/DB_USER=learnsrinagar/" .env', { cwd: '/var/www/learnsrinagar.in' });
    await ssh.execCommand('sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=e3iWzvZnZifgN38OiM2Q/" .env', { cwd: '/var/www/learnsrinagar.in' });

    console.log("Uploading deploy.tar.gz...");
    await ssh.putFile('deploy.tar.gz', '/var/www/learnsrinagar.in/deploy.tar.gz');
    console.log("Upload complete!");

    console.log("Extracting archive...");
    let res = await ssh.execCommand('tar -xzf deploy.tar.gz', { cwd: '/var/www/learnsrinagar.in' });
    if(res.stderr) console.error("Extract stderr:", res.stderr);

    console.log("Installing dependencies...");
    res = await ssh.execCommand('npm install', { cwd: '/var/www/learnsrinagar.in' });
    console.log("Install logs:", res.stdout);
    if(res.stderr) console.error("Install stderr:", res.stderr);

    console.log("Building application...");
    res = await ssh.execCommand('npm run build', { cwd: '/var/www/learnsrinagar.in' });
    console.log("Build logs:", res.stdout);
    if(res.stderr) console.error("Build stderr:", res.stderr);

    console.log("Restarting PM2...");
    res = await ssh.execCommand('pm2 restart learnsrinagar', { cwd: '/var/www/learnsrinagar.in' });
    console.log("PM2:", res.stdout);

    console.log("Cleaning up...");
    await ssh.execCommand('rm deploy.tar.gz', { cwd: '/var/www/learnsrinagar.in' });

    ssh.dispose();
    console.log("Deployment Successful!");
  } catch (err) {
    console.error("Deploy error depth:", JSON.stringify(err, null, 2));
    console.error("Deploy error message:", err.message);
    ssh.dispose();
    process.exit(1);
  }
}

deploy();
