import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function fixFirebaseKey() {
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

    // 1. Upload the new service account key
    console.log("Uploading new service-account.json...");
    await ssh.putFile('service-account.json', `${projectDir}/service-account.json`);
    console.log("New service account key uploaded!");

    // 2. Verify the file was uploaded correctly
    console.log("\nVerifying uploaded key...");
    let res = await ssh.execCommand(`cat ${projectDir}/service-account.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const j=JSON.parse(d);console.log('project_id:', j.project_id);console.log('private_key_id:', j.private_key_id);console.log('client_email:', j.client_email);"`, { cwd: projectDir });
    console.log(res.stdout || res.stderr);

    // 3. Restart PM2 process to pick up the new key
    console.log("\nRestarting PM2 process 'learnsrinagar'...");
    res = await ssh.execCommand('pm2 restart learnsrinagar');
    console.log(res.stdout || res.stderr);

    // 4. Wait a few seconds for the app to boot
    console.log("\nWaiting 5 seconds for app to start...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Check PM2 status
    console.log("\nChecking PM2 status...");
    res = await ssh.execCommand('pm2 status');
    console.log(res.stdout);

    // 6. Check latest logs for Firebase initialization
    console.log("\nChecking logs for Firebase init...");
    res = await ssh.execCommand('pm2 logs learnsrinagar --lines 30 --nostream');
    console.log(res.stdout || res.stderr);

    ssh.dispose();
    console.log("\n=== Firebase Key Fix Complete ===");
  } catch (err) {
    console.error("Error:", err.message);
    if (err.stack) console.error(err.stack);
    ssh.dispose();
    process.exit(1);
  }
}

fixFirebaseKey();
