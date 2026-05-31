const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, '..', 'frontend', 'src', 'app', 'api');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Add import if not present
  if (!content.includes("import { createErrorResponse }")) {
    const firstImport = content.match(/^import .+$/m);
    if (firstImport) {
      content = content.replace(firstImport[0], firstImport[0] + "\nimport { createErrorResponse } from '@/lib/api-error-handler';");
      modified = true;
    }
  }

  // Replace generic error responses with createErrorResponse
  // Pattern: return NextResponse.json({ error: '...' }, { status: 500 });
  const original = content;
  content = content.replace(
    /return NextResponse\.json\(\{ error: '([^']+)' \}, \{ status: 500 \}\);/g,
    "return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', '$1'), { status: 500 });"
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: "([^"]+)" \}, \{ status: 500 \}\);/g,
    "return NextResponse.json(createErrorResponse('STORAGE_UNAVAILABLE', '$1'), { status: 500 });"
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: '([^']+)' \}, \{ status: 400 \}\);/g,
    "return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', '$1'), { status: 400 });"
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: "([^"]+)" \}, \{ status: 400 \}\);/g,
    "return NextResponse.json(createErrorResponse('AGENT_INVALID_JSON', '$1'), { status: 400 });"
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: '([^']+)' \}, \{ status: 404 \}\);/g,
    "return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', '$1'), { status: 404 });"
  );
  content = content.replace(
    /return NextResponse\.json\(\{ error: "([^"]+)" \}, \{ status: 404 \}\);/g,
    "return NextResponse.json(createErrorResponse('FILE_NOT_FOUND', '$1'), { status: 404 });"
  );

  if (content !== original) {
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log('Updated:', path.relative(apiDir, filePath));
  }
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
console.log('Done updating API error contracts');
