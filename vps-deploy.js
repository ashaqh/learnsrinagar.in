import { NodeSSH } from 'node-ssh';
import fs from 'fs';

const ssh = new NodeSSH();

async function deploy() {
  try {
    console.log("Connecting to VPS 187.127.130.18...");
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });
    console.log("Connected!");
    
    const projectDir = '/var/www/learnsrinagar.in';

    console.log(`Ensuring project directory exists at ${projectDir}...`);
    await ssh.execCommand(`mkdir -p ${projectDir}`);

    console.log("Uploading environment configuration...");
    await ssh.putFile('.env.production', `${projectDir}/.env`);
    console.log("Environment uploaded!");
    
    console.log("Uploading deploy.tar.gz...");
    await ssh.putFile('deploy.tar.gz', `${projectDir}/deploy.tar.gz`);
    console.log("Upload complete!");

    console.log("Extracting archive...");
    let res = await ssh.execCommand('tar -xzf deploy.tar.gz', { cwd: projectDir });
    if(res.stderr) console.log("Note: Extract stderr (often non-fatal):", res.stderr);

    console.log("Installing node dependencies...");
    res = await ssh.execCommand('npm install --production --legacy-peer-deps', { cwd: projectDir });
    console.log("Install logs:", res.stdout.substring(0, 500) + "...");

    console.log("Running database migrations/updates...");
    res = await ssh.execCommand('node update_db.js', { cwd: projectDir });
    console.log("Migration output:", res.stdout || res.stderr);
    
    console.log("Building Remix application...");
    res = await ssh.execCommand('npm run build', { cwd: projectDir });
    console.log("Build output:", res.stdout.substring(res.stdout.length - 500));

    console.log("Managing PM2 process...");
    // Check if process exists to avoid duplicate entries
    res = await ssh.execCommand('pm2 jlist');
    const apps = JSON.parse(res.stdout || '[]');
    const appExists = apps.some(app => app.name === 'learnsrinagar');

    if (!appExists) {
      console.log("Starting new PM2 service 'learnsrinagar'...");
      await ssh.execCommand('pm2 start npm --name "learnsrinagar" -- start', { cwd: projectDir });
    } else {
      console.log("Restarting existing PM2 service 'learnsrinagar'...");
      await ssh.execCommand('pm2 restart learnsrinagar');
    }
    await ssh.execCommand('pm2 save');

    console.log("Uploading Nginx configuration...");
    await ssh.putFile('learnsrinagar.nginx.conf', '/etc/nginx/sites-available/learnsrinagar.in');
    
    console.log("Configuring Nginx symlink and restarting...");
    await ssh.execCommand('ln -sf /etc/nginx/sites-available/learnsrinagar.in /etc/nginx/sites-enabled/');
    await ssh.execCommand('nginx -t && systemctl restart nginx');
    console.log("Nginx restarted successfully!");

    console.log("Cleaning up...");
    await ssh.execCommand('rm deploy.tar.gz', { cwd: projectDir });

    ssh.dispose();
    console.log("=== Deployment Successfully Completed ===");
  } catch (err) {
    console.error("Critical Deployment Error:", err.message);
    if (err.stack) console.error(err.stack);
    ssh.dispose();
    process.exit(1);
  }
}

deploy();
