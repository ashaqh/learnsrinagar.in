// Quick deployment check script
console.log('Checking deployment configuration...');

// Check if all required files exist
const fs = require('fs');
const path = require('path');

const requiredFiles = [
  'package.json',
  'vite.config.js',
  'src/root.jsx',
  'src/pages/index.jsx',
  'src/pages/login.jsx'
];

console.log('Required files check:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${file}: ${exists ? '✓' : '✗'}`);
});

// Check build directory
const buildExists = fs.existsSync(path.join(__dirname, 'build'));
console.log(`\nBuild directory exists: ${buildExists ? '✓' : '✗'}`);

if (buildExists) {
  const serverExists = fs.existsSync(path.join(__dirname, 'build/server'));
  const clientExists = fs.existsSync(path.join(__dirname, 'build/client'));
  console.log(`Server build: ${serverExists ? '✓' : '✗'}`);
  console.log(`Client build: ${clientExists ? '✓' : '✗'}`);
}

console.log('\nIf build directory is missing, run: npm run build');
console.log('If server files are missing, ensure your VPS has Node.js and all dependencies installed');