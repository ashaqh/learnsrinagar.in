import { NodeSSH } from 'node-ssh';
import path from 'path';

const ssh = new NodeSSH();

async function deploy() {
  try {
    await ssh.connect({
      host: '187.127.130.18',
      username: 'root',
      password: 'Acxak@7006774383'
    });

    console.log('Connected to VPS');

    // 1. Upload the archive
    const localDir = process.cwd();
    const localFile = path.join(localDir, 'deploy.tar.gz').replace(/\\/g, '/');
    const remoteDir = '/var/www/learnsrinagar.in';
    const remoteFile = `${remoteDir}/deploy.tar.gz`;

    console.log(`Uploading ${localFile} to ${remoteFile}...`);
    await ssh.putFile(localFile, remoteFile);
    console.log('Upload complete');

    // 2. Extract and Restart
    console.log('Extracting and restarting...');
    const commandChain = [
      `cd ${remoteDir}`,
      'tar -xzf deploy.tar.gz',
      'npm install',
      'npm run build',
      'pm2 restart learnsri || pm2 start npm --name "learnsri" -- start',
      'rm deploy.tar.gz'
    ].join(' && ');

    console.log(`Running: ${commandChain}`);
    const result = await ssh.execCommand(commandChain);
    
    if (result.stdout) console.log('STDOUT:', result.stdout);
    if (result.stderr) console.warn('STDERR:', result.stderr);

    if (result.code === 0) {
      console.log('Deployment successful!');
    } else {
      console.error(`Deployment failed with exit code ${result.code}`);
    }
  } catch (error) {
    console.error('Deployment failed:', error);
  } finally {
    ssh.dispose();
  }
}

deploy();
