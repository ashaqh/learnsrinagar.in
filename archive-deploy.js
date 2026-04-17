import { execSync } from 'child_process';

const filesToInclude = [
  'src',
  'public',
  'package.json',
  'package-lock.json',
  'vite.config.js',
  'jsconfig.json',
  'server-config.js',
  'start-production.sh',
  '.env.example',
  'service-account.json'
];

console.log('Creating deploy.tar.gz...');
// Use windows tar if available, or just shell out to it
const command = `tar -czf deploy.tar.gz ${filesToInclude.join(' ')}`;

try {
  execSync(command, { stdio: 'inherit' });
  console.log('Successfully created deploy.tar.gz');
} catch (error) {
  console.error('Failed to create archive:', error);
  process.exit(1);
}
