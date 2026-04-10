import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function investigateFail() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    console.log("=== Checking PM2 Status ===");
    let res = await ssh.execCommand('pm2 info learnsrinagar', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);

    console.log("=== Checking Build Directory ===");
    res = await ssh.execCommand('ls -la build/server', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);
    if (res.stderr) console.error("stderr:", res.stderr);

    res = await ssh.execCommand('ls -la build', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

investigateFail();
