#!/usr/bin/env node
// Quick test to verify opencode settings persistence after reset

const BASE = 'http://127.0.0.1:3000';

async function request(method, path, body, headers = {}) {
  const opts = { method, headers };
  if (body) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const resp = await fetch(`${BASE}${path}`, opts);
  const text = await resp.text();
  return { status: resp.status, body: text };
}

async function main() {
  console.log('1. Reset...');
  let r = await request('POST', '/api/testing/reset');
  console.log(`   reset -> ${r.status}`);

  console.log('2. Get opencode settings (should be seeded defaults)...');
  r = await request('GET', '/api/opencode-settings');
  console.log(`   get settings -> ${r.status}`, r.body);
  const before = JSON.parse(r.body);

  console.log('3. Save opencode settings...');
  const settings = {
    binaryPath: '/Users/mistlight/Projects/Experiments/HackerDojoGrantApp/scripts/opencode-real-wrapper.sh',
    workingDirectory: '/Users/mistlight/Projects/Experiments/HackerDojoGrantApp',
    timeoutMs: 120000,
    profile: 'default',
    isConfigured: true
  };
  r = await request('PUT', '/api/opencode-settings', settings);
  console.log(`   put settings -> ${r.status}`, r.body);

  console.log('4. Get opencode settings (should reflect update)...');
  r = await request('GET', '/api/opencode-settings');
  console.log(`   get settings -> ${r.status}`, r.body);
  const after = JSON.parse(r.body);

  console.log('5. Run research (should succeed with isConfigured=true)...');
  r = await request('POST', '/api/research');
  console.log(`   research -> ${r.status}`, r.body.substring(0, 200));

  console.log('\n=== RESULTS ===');
  console.log('isConfigured before:', before.isConfigured);
  console.log('isConfigured after:', after.isConfigured);
  console.log('Research succeeded:', r.status === 200);

  if (r.status !== 200) {
    console.log('\n!!! RESEARCH FAILED !!!');
    process.exit(1);
  } else {
    console.log('\n✓ ALL CHECKS PASSED');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});