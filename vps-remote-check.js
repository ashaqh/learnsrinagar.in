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

    console.log("=== Disk Space ===");
    let res = await ssh.execCommand('df -h /var/www/learnsrinagar.in');
    console.log(res.stdout);

    console.log("=== MySQL Databases ===");
    res = await ssh.execCommand('mysql -e "SHOW DATABASES;"');
    console.log(res.stdout || "No databases found or command failed");
    if(res.stderr) console.error("MySQL ERR:", res.stderr);

    console.log("=== LearnSrinagar Table Check ===");
    res = await ssh.execCommand('mysql -e "USE learnsrinagar; SHOW TABLES;"');
    console.log(res.stdout || "No tables found");
    if(res.stderr) console.error("Table ERR:", res.stderr);

    ssh.dispose();
  } catch (err) {
    console.error(err);
  }
}

checkRemote();
