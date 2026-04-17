import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function checkLogs() {
  try {
    console.log("Connecting to VPS...");
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    console.log("=== PM2 Status ===");
    let res = await ssh.execCommand('pm2 status', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);

    console.log("\n=== PM2 Logs (learnsrinagar) ===");
    res = await ssh.execCommand('pm2 logs learnsrinagar --lines 100 --nostream', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);
    if (res.stderr) console.error("Stderr logs:", res.stderr);

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

checkLogs();
