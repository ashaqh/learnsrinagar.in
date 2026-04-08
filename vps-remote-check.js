import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();

async function checkRemote() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383',
      readyTimeout: 10000
    });

    console.log("=== Git Status ===");
    let res = await ssh.execCommand('git status', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);
    if(res.stderr) console.error("ERR:", res.stderr);

    console.log("=== Node Modules ===");
    res = await ssh.execCommand('ls -la node_modules | head -n 5', { cwd: '/var/www/learnsrinagar.in' });
    console.log(res.stdout);

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

checkRemote();
