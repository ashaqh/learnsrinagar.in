import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function investigate() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    console.log("=== Node & PM2 ===");
    let res = await ssh.execCommand('node -v && npm -v');
    console.log(res.stdout);
    res = await ssh.execCommand('pm2 status || pm2 list');
    console.log(res.stdout);

    console.log("=== Web directories ===");
    res = await ssh.execCommand('ls -la /var/www/');
    console.log(res.stdout);
    res = await ssh.execCommand('ls -la /var/www/html/ || echo "no /var/www/html"');
    console.log(res.stdout);

    console.log("=== Nginx Config ===");
    res = await ssh.execCommand('ls -la /etc/nginx/sites-enabled/');
    console.log(res.stdout);
    res = await ssh.execCommand('cat /etc/nginx/sites-enabled/*');
    console.log(res.stdout);

    console.log("=== Processes ===");
    res = await ssh.execCommand('netstat -tulnp | grep -E "node|nginx|docker|80|443|3000|5173|3001"');
    console.log(res.stdout);

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

investigate();
