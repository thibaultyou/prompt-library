#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run TypeScript compiler
console.log('Running TypeScript compiler...');
execSync('tsc', { stdio: 'inherit' });

// Add shebang to main.js
console.log('Adding shebang to main.js...');
const mainJsPath = path.join(__dirname, 'dist', 'main.js');
const content = fs.readFileSync(mainJsPath, 'utf8');
const shebang = '#!/usr/bin/env node\n';
fs.writeFileSync(mainJsPath, shebang + content);

// Make executable
console.log('Making main.js executable...');
execSync(`chmod +x ${mainJsPath}`, { stdio: 'inherit' });

console.log('Build complete!');