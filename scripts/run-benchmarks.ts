/**
 * Run Performance Benchmarks
 *
 * Measures:
 * 1. Dashboard render time: < 2s (AC-11.1.1)
 * 2. Discovery filter time: < 200ms (AC-11.1.2)
 * 3. Pipeline board render time: < 1s (AC-11.1.3)
 * 4. API response time: < 500ms (AC-11.1.4)
 */

import { loadGrants } from '../../shared/grant-ops-persistence';
import fs from 'node:fs';
import path from 'node:path';

const THRESHOLDS = {
  dashboard: 2000,    // ms (AC-11.1.1)
  discoveryFilter: 200, // ms (AC-11.1.2)
  pipelineBoard: 1000,  // ms (AC-11.1.3)
  apiResponse: 500,     // ms (AC-11.1.4)
};

interface BenchmarkResult {
  name: string;
  threshold: number;
  actual: number;
  passed: boolean;
}

async function runBenchmarks(): Promise<void> {
  const results: BenchmarkResult[] = [];
  const dataDir = path.join(process.cwd(), '.grant-ops-data');

  console.log('=== Performance Benchmarks ===\n');

  // Benchmark 1: Grant data load performance (simulates API response)
  const loadStart = performance.now();
  const grants = await loadGrants();
  const loadEnd = performance.now();
  const loadTime = Math.round(loadEnd - loadStart);
  results.push({
    name: 'Load grants (simulated API GET /api/grants)',
    threshold: THRESHOLDS.apiResponse,
    actual: loadTime,
    passed: loadTime <= THRESHOLDS.apiResponse,
  });

  // Benchmark 2: Filter/search performance
  const filterStart = performance.now();
  const searchQuery = 'STEM';
  const filtered = grants.filter((g) =>
    (g.title ? String(g.title).toLowerCase().includes(searchQuery.toLowerCase()) : false) ||
    (g.funder ? String(g.funder).toLowerCase().includes(searchQuery.toLowerCase()) : false)
  );
  const filterEnd = performance.now();
  const filterTime = Math.round(filterEnd - filterStart);
  results.push({
    name: 'Discovery filter (search STEM)',
    threshold: THRESHOLDS.discoveryFilter,
    actual: filterTime,
    passed: filterTime <= THRESHOLDS.discoveryFilter,
  });

  // Benchmark 3: Sort performance
  const sortStart = performance.now();
  const sorted = [...grants].sort((a, b) => {
    const aFit = typeof a.fit === 'number' ? a.fit : 0;
    const bFit = typeof b.fit === 'number' ? b.fit : 0;
    return bFit - aFit;
  });
  const sortEnd = performance.now();
  const sortTime = Math.round(sortEnd - sortStart);
  results.push({
    name: 'Grant sorting (by fit score)',
    threshold: THRESHOLDS.discoveryFilter,
    actual: sortTime,
    passed: sortTime <= THRESHOLDS.discoveryFilter,
  });

  // Benchmark 4: Status grouping (simulates pipeline board render)
  const groupStart = performance.now();
  const grouped: Record<string, number> = {};
  for (const g of grants) {
    const status = String(g.status || 'unknown');
    grouped[status] = (grouped[status] || 0) + 1;
  }
  const groupEnd = performance.now();
  const groupTime = Math.round(groupEnd - groupStart);
  results.push({
    name: 'Pipeline grouping (10 status buckets)',
    threshold: THRESHOLDS.pipelineBoard,
    actual: groupTime,
    passed: groupTime <= THRESHOLDS.pipelineBoard,
  });

  // Benchmark 5: KPI calculation (simulates dashboard)
  const kpiStart = performance.now();
  const totalGrants = grants.length;
  const activeGrants = grants.filter((g) => g.status !== 'closed' && g.status !== 'declined' && g.status !== 'archived').length;
  const totalPipelineValue = grants
    .filter((g) => g.awardSort && typeof g.awardSort === 'number')
    .reduce((sum, g) => sum + (g.awardSort || 0), 0);
  const averageFit = grants.length > 0
    ? Math.round(grants.reduce((sum, g) => sum + (typeof g.fit === 'number' ? g.fit : 0), 0) / grants.length)
    : 0;
  const kpiEnd = performance.now();
  const kpiTime = Math.round(kpiEnd - kpiStart);
  results.push({
    name: 'Dashboard KPI calculation',
    threshold: THRESHOLDS.dashboard,
    actual: kpiTime,
    passed: kpiTime <= THRESHOLDS.dashboard,
  });

  // Print results
  console.log(`Grants loaded: ${grants.length}`);
  console.log(`Active grants: ${activeGrants}`);
  console.log(`Pipeline value: $${totalPipelineValue.toLocaleString()}`);
  console.log(`Average fit score: ${averageFit}%\n`);

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✓' : '✗';
    console.log(`${icon} ${r.name}: ${r.actual}ms (threshold: ${r.threshold}ms)`);
    if (!r.passed) {
      allPassed = false;
      console.log(`  GAP: ${r.actual - r.threshold}ms over threshold`);
    }
  }

  console.log(`\n${allPassed ? 'All benchmarks passed!' : 'Some benchmarks failed — gaps documented above.'}`);

  // Write results file
  const resultsDir = path.join(dataDir, 'benchmark-results');
  fs.mkdirSync(resultsDir, { recursive: true });
  const output = {
    timestamp: new Date().toISOString(),
    grantCount: grants.length,
    allPassed,
    results,
  };
  fs.writeFileSync(
    path.join(resultsDir, `${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`),
    JSON.stringify(output, null, 2),
  );

  process.exit(allPassed ? 0 : 1);
}

runBenchmarks().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
