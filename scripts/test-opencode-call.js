const { execFileSync } = require('node:child_process');

const prompt = `Return only valid JSON. No markdown, no prose, no explanation.

You are an AI assistant. Generate 1-2 sample grant opportunities as a JSON array.
Each grant must include: id, title, funder, funderShort, award, awardSort, deadline, daysOut, fit, tags, status, statusLabel, matchedAt, externalUrl, funderSummary.

Search query: STEM education California

Return ONLY the JSON array, nothing else.`;

console.log('Running opencode...');
const start = Date.now();
try {
  const result = execFileSync('/home/mistlight/.opencode/bin/opencode', ['run', '--format', 'json', prompt], {
    cwd: '/home/mistlight/Hacker-Dojo-Grant-Ops-Dashboard-Command-Center',
    timeout: 120000,
    encoding: 'utf8',
  });
  console.log('Duration:', Date.now() - start, 'ms');
  console.log('Output length:', result.length);
  
  // Parse NDJSON
  const lines = result.trim().split('\n');
  const textLines = lines.filter(l => {
    try { const p = JSON.parse(l); return p.type === 'text'; } catch { return false; }
  });
  console.log('Text responses:', textLines.length);
  textLines.forEach(l => {
    const p = JSON.parse(l);
    console.log('  Text:', p.part?.text?.substring(0, 200));
  });
} catch(e) {
  console.log('Duration:', Date.now() - start, 'ms');
  console.log('ERROR:', e.message);
  console.log('CODE:', e.code);
  console.log('SIGNAL:', e.signal);
}
