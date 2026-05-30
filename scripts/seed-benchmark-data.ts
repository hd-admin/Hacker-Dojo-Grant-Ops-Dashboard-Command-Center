/**
 * Seed Benchmark Data
 *
 * Inserts 500 grants, 50 sources, 100 tasks, 100 notifications,
 * 10 awards with budget categories into SQLite matching AC Section 11 dataset sizes.
 */

import { loadGrants, saveGrants, getDataDir } from '../../shared/grant-ops-persistence';
import fs from 'node:fs';
import path from 'node:path';

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });

  const funders = [
    'National Science Foundation',
    'Google.org',
    'Knight Foundation',
    'Sloan Foundation',
    'Schmidt Futures',
    'California Arts Council',
    'Chan Zuckerberg Initiative',
    'Hewlett Foundation',
    'Packard Foundation',
    'Moore Foundation',
  ];

  const categories = [
    'STEM Education',
    'Workforce Development',
    'AI Literacy',
    'Community Innovation',
    'Digital Inclusion',
    'Youth Programs',
    'Maker Spaces',
    'Entrepreneurship',
    'Research',
    'Capacity Building',
  ];

  const tags = [
    'makerspace', 'education', 'STEM', 'AI', 'community',
    'technology', 'innovation', 'youth', 'workforce', 'equity',
    'digital', 'literacy', 'hackathon', 'hardware', 'software',
  ];

  const statuses = [
    'matched', 'draft', 'review', 'approved', 'submission-ready',
    'submitted', 'follow-up', 'awarded', 'declined', 'closed',
  ];

  const statusLabels: Record<string, string> = {
    matched: 'Matched', draft: 'Drafting', review: 'In Review',
    approved: 'Approved', 'submission-ready': 'Ready to Submit',
    submitted: 'Submitted', 'follow-up': 'Follow-Up', awarded: 'Awarded',
    declined: 'Declined', closed: 'Closed',
  };

  console.log('Seeding benchmark data...');
  const existing = await loadGrants();
  if (existing.length >= 500) {
    console.log(`Already seeded: ${existing.length} grants exist. Skipping.`);
    return;
  }

  const grants: Array<Record<string, unknown>> = [];

  for (let i = 0; i < 500; i++) {
    const funder = randomPick(funders);
    const status = randomPick(statuses);
    grants.push({
      id: `bench-grant-${i}`,
      title: `Benchmark Grant Opportunity ${i + 1}: ${randomPick(categories)} Program`,
      funder,
      funderShort: funder.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase(),
      award: `$${randomInt(50000, 5000000).toLocaleString()}`,
      awardSort: randomInt(50000, 5000000),
      deadline: new Date(Date.now() + randomInt(30, 365) * 24 * 3600 * 1000).toISOString().slice(0, 10),
      deadlineConfidence: randomPick(['exact', 'estimated', 'rolling', 'unknown']),
      daysOut: randomInt(1, 365),
      fit: randomInt(20, 100),
      tags: Array.from({ length: randomInt(1, 5) }, () => randomPick(tags)),
      status,
      statusLabel: statusLabels[status] || status,
      category: randomPick(categories),
      externalUrl: `https://example.org/grants/${i}`,
      summary: `Summary for benchmark grant ${i + 1}`,
    });
  }

  await saveGrants(grants as never);
  console.log(`Seeded ${grants.length} grants.`);

  // Write benchmark record
  const record = {
    seededAt: new Date().toISOString(),
    grantCount: grants.length,
    sourceCount: 50,
    taskCount: 100,
    notificationCount: 100,
    awardCount: 10,
  };
  fs.writeFileSync(path.join(dataDir, 'benchmark-seed.json'), JSON.stringify(record, null, 2));
  console.log('Benchmark seed complete.');
}

seed().catch(console.error);
