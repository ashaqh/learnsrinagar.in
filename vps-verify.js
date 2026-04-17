import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function verify() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    console.log("=== PM2 Status ===");
    let res = await ssh.execCommand('pm2 list');
    console.log(res.stdout);

    console.log("=== App Responsiveness (Port 3000) ===");
    res = await ssh.execCommand('curl -I http://localhost:3000');
    console.log(res.stdout || "No response from port 3000");

    console.log("=== Running Processes ===");
    res = await ssh.execCommand('netstat -tpln | grep 3000');
    console.log(res.stdout || "Port 3000 not found in netstat");

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

verify();
