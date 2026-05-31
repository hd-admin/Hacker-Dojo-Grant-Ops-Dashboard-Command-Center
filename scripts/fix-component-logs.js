const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, '..', 'frontend', 'src', 'components');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('console.error')) return;

  const basename = path.basename(filePath);
  console.log(`Processing ${basename}...`);

  // For components, replace console.error with setError state
  // First, check if useState is imported
  if (!content.includes('useState')) {
    // Add useState to react import
    if (content.includes("import { useEffect } from 'react'")) {
      content = content.replace("import { useEffect } from 'react'", "import { useEffect, useState } from 'react'");
    } else if (content.includes("import React from 'react'")) {
      // Keep as is, we'll use React.useState
    } else {
      // Add import
      const firstImport = content.match(/^import .+$/m);
      if (firstImport) {
        content = content.replace(firstImport[0], "import { useState } from 'react';\n" + firstImport[0]);
      }
    }
  }

  // Add error state after first useState or at beginning of component function
  if (!content.includes('const [error,')) {
    const stateMatches = [...content.matchAll(/const \[\w+, set\w+\] = useState/g)];
    if (stateMatches.length > 0) {
      const lastMatch = stateMatches[stateMatches.length - 1];
      const rest = content.slice(lastMatch.index + lastMatch[0].length);
      const semiIndex = rest.indexOf(';');
      const insertPos = lastMatch.index + lastMatch[0].length + semiIndex + 1;
      content = content.slice(0, insertPos) + "\n  const [error, setError] = useState<string | null>(null);" + content.slice(insertPos);
    } else {
      // Add after component function declaration
      const funcMatch = content.match(/export default function \w+\([^)]*\)\s*\{/);
      if (funcMatch) {
        const insertPos = funcMatch.index + funcMatch[0].length;
        content = content.slice(0, insertPos) + "\n  const [error, setError] = useState<string | null>(null);" + content.slice(insertPos);
      }
    }
  }

  // Replace console.error with setError
  content = content.replace(/console\.error\(['"`](.+?)['"`](,\s*(\w+))?\);/g, (match, msg) => {
    const cleanMsg = msg.replace(/:$/, '').trim();
    return `setError('${cleanMsg}');`;
  });

  fs.writeFileSync(filePath, content);
}

for (const file of fs.readdirSync(componentsDir)) {
  if (file.endsWith('.tsx') && !file.includes('.test.')) {
    processFile(path.join(componentsDir, file));
  }
}

console.log('Done processing components');
