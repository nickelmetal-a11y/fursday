const fs = require('fs');
const path = 'src/AdminPanel.js';
let content = fs.readFileSync(path, 'utf8');
const before = content.length;

const target = "const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || 'fursday2025admin';";

if (!content.includes(target)) {
  console.log('TARGET NOT FOUND - no changes made.');
  process.exit(1);
}

const replacement = "const ADMIN_PASSWORD = process.env.REACT_APP_ADMIN_PASSWORD || '';";

content = content.replace(target, replacement);
fs.writeFileSync(path, content, 'utf8');

console.log('DONE. Size before:', before, 'after:', content.length);
console.log('Old fallback gone?', !content.includes('fursday2025admin'));