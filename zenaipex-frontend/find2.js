const fs = require('fs');
const lines = fs.readFileSync('app/admin/agents/page.tsx', 'utf8').split('\n');
console.log(lines.findIndex(l => l.includes('{activeTab === "custom_voices" && (')));
