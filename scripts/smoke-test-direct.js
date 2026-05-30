// Standalone ProPublica smoke test - direct opencode call, no HTTP server needed
const { execFileSync } = require('node:child_process');

const query = 'STEM education nonprofit California';

const prompt = [
  'Return only valid JSON. No markdown, no prose, no explanation.',
  '',
  'You are searching ProPublica Nonprofit Explorer for real grant opportunities.',
  'ProPublica Nonprofit Explorer (https://projects.propublica.org/nonprofits/) is a public database',
  'of nonprofit tax filings (Form 990) that includes grant amounts, funders, and recipients.',
  '',
  'Based on the search query below, identify 1-5 real grant opportunities that are verifiable',
  'through ProPublica data. Each grant must include ALL of the following fields as a JSON array:',
  '',
  '  - id: unique string identifier',
  '  - title: descriptive grant/program name',
  '  - funder: name of the funding organization',
  '  - funderShort: abbreviated funder name',
  '  - award: award amount as string (e.g. "$50,000" or "Unknown")',
  '  - awardSort: numeric award amount for sorting (0 if unknown)',
  '  - deadline: ISO date string (YYYY-MM-DD) or "Rolling" if no fixed deadline',
  '  - daysOut: estimated days until deadline (365 if Rolling)',
  '  - fit: numeric fit score 0-100 based on query relevance',
  '  - tags: array of relevant keyword strings',
  '  - status: "matched"',
  '  - statusLabel: "Matched"',
  '  - matchedAt: current ISO timestamp',
  '  - externalUrl: "https://projects.propublica.org/nonprofits/"',
  '  - funderSummary: brief description of the funder',
  '',
  'If you cannot find any real grants matching the query, return an empty array: []',
  '',
  `Search query: ${query}`,
].join('\n');

function parseOutput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter(i => i && typeof i.title === 'string' && typeof i.funder === 'string');
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.grants)) return parsed.grants.filter(i => i && typeof i.title === 'string');
    return [];
  } catch {
    const fb = trimmed.indexOf('[');
    if (fb >= 0) {
      let depth = 0, end = -1;
      const sub = trimmed.slice(fb);
      for (let i = 0; i < sub.length; i++) {
        if (sub[i] === '[') depth++;
        if (sub[i] === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
      }
      if (end > 0) {
        try { const p = JSON.parse(sub.slice(0, end)); if (Array.isArray(p)) return p.filter(i => i && typeof i.title === 'string'); } catch {}
      }
    }
  }
  return [];
}

console.log('=== ProPublica Smoke Test (Direct Opencode) ===');
console.log('Query:', query);
console.log('');

const start = Date.now();
let output;
try {
  output = execFileSync('/home/mistlight/.opencode/bin/opencode', ['run', '--format', 'json', prompt], {
    cwd: '/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center',
    timeout: 180000,
    encoding: 'utf8',
  });
} catch (e) {
  console.error('FAIL: opencode execution error:', e.message);
  process.exit(1);
}

const duration = Date.now() - start;
console.log('Opencode call completed in', duration, 'ms');

// Extract text from NDJSON
const lines = output.trim().split('\n');
let textContent = '';
for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.type === 'text' && entry.part?.text) {
      textContent += entry.part.text;
    }
  } catch {}
}

if (!textContent) {
  console.error('FAIL: No text content in opencode response');
  process.exit(1);
}

const grants = parseOutput(textContent);
if (!Array.isArray(grants) || grants.length === 0) {
  console.error('FAIL: No valid grants found in response');
  console.error('Raw text (first 500 chars):', textContent.substring(0, 500));
  process.exit(1);
}

const first = grants[0];
if (!first.title || !first.funder) {
  console.error('FAIL: First grant missing title or funder');
  process.exit(1);
}

console.log('');
console.log('=== SMOKE TEST PASSED ===');
console.log('Grants found:', grants.length);
console.log('First grant:', first.title, '/', first.funder);
console.log('Award:', first.award || 'Unknown');
console.log('Deadline:', first.deadline || 'Unknown');
console.log('Fit score:', first.fit || 'N/A');
if (first.tags && first.tags.length > 0) console.log('Tags:', first.tags.join(', '));
