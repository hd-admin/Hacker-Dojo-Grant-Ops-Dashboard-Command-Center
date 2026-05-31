const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'frontend', 'src', 'app', 'api');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('console.error')) return;

  // Add logger import if not present
  if (!content.includes("import { logger } from '@/lib/logger'")) {
    const firstImport = content.match(/^import .+$/m);
    if (firstImport) {
      content = content.replace(firstImport[0], firstImport[0] + "\nimport { logger } from '@/lib/logger';");
    }
  }

  // Replace console.error patterns
  // Pattern 1: console.error('message:', error)
  content = content.replace(/console\.error\(['"`](.+?)['"`](,\s*(\w+))?\)/g, (match, msg, _, errVar) => {
    const cleanMsg = msg.replace(/:$/, '').trim();
    if (errVar) {
      return `logger.error({ err: ${errVar} }, '${cleanMsg}')`;
    }
    return `logger.error('${cleanMsg}')`;
  });

  fs.writeFileSync(filePath, content);
}

function walkDir(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (entry === 'route.ts') {
      processFile(fullPath);
    }
  }
}

walkDir(apiDir);
console.log('Done processing API routes');
