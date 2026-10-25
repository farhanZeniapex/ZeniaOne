const fs = require('fs');
const path = require('path');
const dirsToSearch = [
  path.join(process.env.APPDATA || '', 'Code', 'User', 'History'),
  path.join(process.env.APPDATA || '', 'Cursor', 'User', 'History')
];

for (const historyDir of dirsToSearch) {
  if (!fs.existsSync(historyDir)) continue;
  console.log("Searching", historyDir);
  search(historyDir);
}

function search(dir) {
  const files = fs.readdirSync(dir);
  for(const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if(stat.isDirectory()) search(full);
    else {
      try {
        const content = fs.readFileSync(full, 'utf8');
        if(content.includes('activeTab === "custom_voices"')) {
          console.log('FOUND:', full);
        }
      } catch(e){}
    }
  }
}
console.log("Done");
