const fs = require('fs');

const originalPath = 'app/admin/agents/page.tsx';
const backupPath = 'app/admin/agents/page.tsx.bak';

// Backup
const originalContent = fs.readFileSync(originalPath, 'utf8');
fs.writeFileSync(backupPath, originalContent);

const lines = originalContent.split('\n');
const replacement = fs.readFileSync('replacement.txt', 'utf8');

const startLine = 1186 - 1; // 0-indexed
const endLine = 1573 - 1; // 0-indexed

// Replace
lines.splice(startLine, endLine - startLine + 1, replacement);

fs.writeFileSync(originalPath, lines.join('\n'));
console.log('Successfully applied patch!');
