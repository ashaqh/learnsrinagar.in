import { NodeSSH } from 'node-ssh';

const ssh = new NodeSSH();
const users = ['root', 'ubuntu', 'opc', 'admin', 'centos', 'debian'];
const password = 'Acxak@7006774383';

async function tryLogin(username) {
  try {
    console.log(`Trying ${username}...`);
    await ssh.connect({
      host: '187.127.130.18',
      username: username,
      password: password,
      tryKeyboard: true,
      onKeyboardInteractive: (name, instructions, instructionsLang, prompts, finish) => {
        if (prompts.length > 0 && prompts[0].prompt.toLowerCase().includes('password')) {
          finish([password]);
        } else {
          finish([]);
        }
      },
      readyTimeout: 5000
    });
    console.log(`Connected successfully as ${username}!`);
    return true;
  } catch (error) {
    console.error(`  Failed for ${username}: ${error.message}`);
    return false;
  }
}

async function checkDeploy() {
  for (const user of users) {
    if (await tryLogin(user)) {
      // Check system info
      let res = await ssh.execCommand('uname -a');
      console.log("OS:", res.stdout);
      
      ssh.dispose();
      process.exit(0);
    }
  }
  process.exit(1);
}

checkDeploy();
