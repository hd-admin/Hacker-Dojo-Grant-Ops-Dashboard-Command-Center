/**
 * Theme Service
 *
 * Manages search themes, keyword clusters, matching policy, and scoring.
 * Persists theme configurations in SQLite via the shared persistence layer.
 *
 * This service uses the DI boundary from dependencies.ts for all external dependencies.
 */

import { loadThemesData, saveThemesData } from '../../../../shared/grant-ops-persistence';
import type {
  InclusionExclusionRule,
  KeywordCluster,
  MatchingPolicy,
  Population,
  Region,
  StrategicPriority,
  Theme,
  ThemesData,
} from '../../../../shared/types';
import { getDependencies } from './dependencies';

// ============ HELPERS ============

const DEFAULT_MATCHING_POLICY: MatchingPolicy = {
  matchThreshold: 70,
  autoDraftThreshold: 85,
  includeRules: [],
  excludeRules: [],
};

function makeTimestamp(): string {
  return getDependencies().clock.now().toISOString();
}

function cloneThemesData(data: ThemesData): ThemesData {
  return JSON.parse(JSON.stringify(data)) as ThemesData;
}

// ============ KEYWORD CLUSTER CRUD ============

export async function addKeywordCluster(
  cluster: KeywordCluster,
): Promise<KeywordCluster> {
  const data = await loadThemesData();
  const now = makeTimestamp();
  const entry: KeywordCluster = {
    ...cluster,
    createdAt: cluster.createdAt || now,
    updatedAt: now,
  };
  data.keywordClusters = data.keywordClusters.filter((kc) => kc.id !== entry.id);
  data.keywordClusters.push(entry);
  await saveThemesData(data);
  return entry;
}

export async function getKeywordClusters(): Promise<KeywordCluster[]> {
  const data = await loadThemesData();
  return cloneThemesData(data).keywordClusters;
}

export async function getKeywordCluster(id: string): Promise<KeywordCluster | null> {
  const data = await loadThemesData();
  return data.keywordClusters.find((kc) => kc.id === id) ?? null;
}

export async function updateKeywordCluster(
  id: string,
  updates: Partial<Omit<KeywordCluster, 'id' | 'createdAt'>>,
): Promise<KeywordCluster> {
  const data = await loadThemesData();
  const existing = data.keywordClusters.find((kc) => kc.id === id);
  if (!existing) {
    throw new Error(`KeywordCluster not found: ${id}`);
  }
  const updated: KeywordCluster = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: makeTimestamp(),
  };
  data.keywordClusters = data.keywordClusters.map((kc) =>
    kc.id === id ? updated : kc,
  );
  await saveThemesData(data);
  return updated;
}

export async function removeKeywordCluster(id: string): Promise<void> {
  const data = await loadThemesData();
  data.keywordClusters = data.keywordClusters.filter((kc) => kc.id !== id);
  await saveThemesData(data);
}

// ============ REGION CRUD ============

export async function addRegion(region: Region): Promise<Region> {
  const data = await loadThemesData();
  const now = makeTimestamp();
  const entry: Region = {
    ...region,
    createdAt: region.createdAt || now,
    updatedAt: now,
  };
  data.regions = data.regions.filter((r) => r.id !== entry.id);
  data.regions.push(entry);
  await saveThemesData(data);
  return entry;
}

export async function getRegions(): Promise<Region[]> {
  const data = await loadThemesData();
  return cloneThemesData(data).regions;
}

export async function getRegion(id: string): Promise<Region | null> {
  const data = await loadThemesData();
  return data.regions.find((r) => r.id === id) ?? null;
}

export async function updateRegion(
  id: string,
  updates: Partial<Omit<Region, 'id' | 'createdAt'>>,
): Promise<Region> {
  const data = await loadThemesData();
  const existing = data.regions.find((r) => r.id === id);
  if (!existing) {
    throw new Error(`Region not found: ${id}`);
  }
  const updated: Region = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: makeTimestamp(),
  };
  data.regions = data.regions.map((r) => (r.id === id ? updated : r));
  await saveThemesData(data);
  return updated;
}

export async function removeRegion(id: string): Promise<void> {
  const data = await loadThemesData();
  data.regions = data.regions.filter((r) => r.id !== id);
  await saveThemesData(data);
}

// ============ POPULATION CRUD ============

export async function addPopulation(population: Population): Promise<Population> {
  const data = await loadThemesData();
  const now = makeTimestamp();
  const entry: Population = {
    ...population,
    createdAt: population.createdAt || now,
    updatedAt: now,
  };
  data.populations = data.populations.filter((p) => p.id !== entry.id);
  data.populations.push(entry);
  await saveThemesData(data);
  return entry;
}

export async function getPopulations(): Promise<Population[]> {
  const data = await loadThemesData();
  return cloneThemesData(data).populations;
}

export async function getPopulation(id: string): Promise<Population | null> {
  const data = await loadThemesData();
  return data.populations.find((p) => p.id === id) ?? null;
}

export async function updatePopulation(
  id: string,
  updates: Partial<Omit<Population, 'id' | 'createdAt'>>,
): Promise<Population> {
  const data = await loadThemesData();
  const existing = data.populations.find((p) => p.id === id);
  if (!existing) {
    throw new Error(`Population not found: ${id}`);
  }
  const updated: Population = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: makeTimestamp(),
  };
  data.populations = data.populations.map((p) => (p.id === id ? updated : p));
  await saveThemesData(data);
  return updated;
}

export async function removePopulation(id: string): Promise<void> {
  const data = await loadThemesData();
  data.populations = data.populations.filter((p) => p.id !== id);
  await saveThemesData(data);
}

// ============ STRATEGIC PRIORITY CRUD ============

export async function addStrategicPriority(
  priority: StrategicPriority,
): Promise<StrategicPriority> {
  const data = await loadThemesData();
  const now = makeTimestamp();
  const entry: StrategicPriority = {
    ...priority,
    createdAt: priority.createdAt || now,
    updatedAt: now,
  };
  data.strategicPriorities = data.strategicPriorities.filter((sp) => sp.id !== entry.id);
  data.strategicPriorities.push(entry);
  await saveThemesData(data);
  return entry;
}

export async function getStrategicPriorities(): Promise<StrategicPriority[]> {
  const data = await loadThemesData();
  return cloneThemesData(data).strategicPriorities;
}

export async function getStrategicPriority(id: string): Promise<StrategicPriority | null> {
  const data = await loadThemesData();
  return data.strategicPriorities.find((sp) => sp.id === id) ?? null;
}

export async function updateStrategicPriority(
  id: string,
  updates: Partial<Omit<StrategicPriority, 'id' | 'createdAt'>>,
): Promise<StrategicPriority> {
  const data = await loadThemesData();
  const existing = data.strategicPriorities.find((sp) => sp.id === id);
  if (!existing) {
    throw new Error(`StrategicPriority not found: ${id}`);
  }
  const updated: StrategicPriority = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: makeTimestamp(),
  };
  data.strategicPriorities = data.strategicPriorities.map((sp) =>
    sp.id === id ? updated : sp,
  );
  await saveThemesData(data);
  return updated;
}

export async function removeStrategicPriority(id: string): Promise<void> {
  const data = await loadThemesData();
  data.strategicPriorities = data.strategicPriorities.filter((sp) => sp.id !== id);
  await saveThemesData(data);
}

// ============ THEME CRUD ============

export async function addTheme(theme: Theme): Promise<Theme> {
  const data = await loadThemesData();
  const now = makeTimestamp();
  const entry: Theme = {
    ...theme,
    createdAt: theme.createdAt || now,
    updatedAt: now,
  };
  data.themes = data.themes.filter((t) => t.id !== entry.id);
  data.themes.push(entry);
  await saveThemesData(data);
  return entry;
}

export async function getThemes(): Promise<Theme[]> {
  const data = await loadThemesData();
  return cloneThemesData(data).themes;
}

export async function getTheme(id: string): Promise<Theme | null> {
  const data = await loadThemesData();
  return data.themes.find((t) => t.id === id) ?? null;
}

export async function getActiveThemes(): Promise<Theme[]> {
  const data = await loadThemesData();
  return data.themes.filter((t) => t.isActive);
}

export async function updateTheme(
  id: string,
  updates: Partial<Omit<Theme, 'id' | 'createdAt'>>,
): Promise<Theme> {
  const data = await loadThemesData();
  const existing = data.themes.find((t) => t.id === id);
  if (!existing) {
    throw new Error(`Theme not found: ${id}`);
  }
  const updated: Theme = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: makeTimestamp(),
  };
  data.themes = data.themes.map((t) => (t.id === id ? updated : t));
  await saveThemesData(data);
  return updated;
}

export async function removeTheme(id: string): Promise<void> {
  const data = await loadThemesData();
  data.themes = data.themes.filter((t) => t.id !== id);
  await saveThemesData(data);
}

// ============ MATCHING POLICY ============

function getActiveThemeFromData(data: ThemesData): Theme | null {
  return data.themes.find((t) => t.isActive) ?? null;
}

function getOrCreateActiveThemeInData(data: ThemesData): Theme {
  const existing = getActiveThemeFromData(data);
  if (existing) return existing;

  const now = makeTimestamp();
  const newTheme: Theme = {
    id: 'theme-default',
    name: 'Default Theme',
    keywordClusters: [],
    regions: [],
    populations: [],
    strategicPriorities: [],
    matchingPolicy: { ...DEFAULT_MATCHING_POLICY },
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  data.themes.push(newTheme);
  return newTheme;
}

export async function getMatchingPolicy(): Promise<MatchingPolicy> {
  const data = await loadThemesData();
  const theme = getActiveThemeFromData(data);
  if (!theme) return { ...DEFAULT_MATCHING_POLICY };
  return { ...theme.matchingPolicy };
}

export async function updateMatchingPolicy(
  updates: Partial<Pick<MatchingPolicy, 'matchThreshold' | 'autoDraftThreshold'>>,
): Promise<MatchingPolicy> {
  const data = await loadThemesData();
  let theme = getActiveThemeFromData(data);
  if (!theme) {
    theme = getOrCreateActiveThemeInData(data);
  }
  theme.matchingPolicy = {
    ...theme.matchingPolicy,
    ...updates,
  };
  theme.updatedAt = makeTimestamp();
  await saveThemesData(data);
  return { ...theme.matchingPolicy };
}

export async function addIncludeRule(rule: InclusionExclusionRule): Promise<InclusionExclusionRule> {
  const data = await loadThemesData();
  const theme = getOrCreateActiveThemeInData(data);
  theme.matchingPolicy.includeRules = theme.matchingPolicy.includeRules.filter(
    (r) => r.id !== rule.id,
  );
  theme.matchingPolicy.includeRules.push(rule);
  theme.updatedAt = makeTimestamp();
  await saveThemesData(data);
  return rule;
}

export async function addExcludeRule(rule: InclusionExclusionRule): Promise<InclusionExclusionRule> {
  const data = await loadThemesData();
  const theme = getOrCreateActiveThemeInData(data);
  theme.matchingPolicy.excludeRules = theme.matchingPolicy.excludeRules.filter(
    (r) => r.id !== rule.id,
  );
  theme.matchingPolicy.excludeRules.push(rule);
  theme.updatedAt = makeTimestamp();
  await saveThemesData(data);
  return rule;
}

export async function removeIncludeRule(ruleId: string): Promise<void> {
  const data = await loadThemesData();
  const theme = getOrCreateActiveThemeInData(data);
  theme.matchingPolicy.includeRules = theme.matchingPolicy.includeRules.filter(
    (r) => r.id !== ruleId,
  );
  theme.updatedAt = makeTimestamp();
  await saveThemesData(data);
}

export async function removeExcludeRule(ruleId: string): Promise<void> {
  const data = await loadThemesData();
  const theme = getOrCreateActiveThemeInData(data);
  theme.matchingPolicy.excludeRules = theme.matchingPolicy.excludeRules.filter(
    (r) => r.id !== ruleId,
  );
  theme.updatedAt = makeTimestamp();
  await saveThemesData(data);
}

// ============ SCORING ============

/**
 * Scores a grant's tags against active themes and keyword clusters.
 * Returns a score 0-100.
 */
export async function scoreGrantByThemes(tags: string[]): Promise<number> {
  const data = await loadThemesData();
  const activeThemes = data.themes.filter((t) => t.isActive);

  if (activeThemes.length === 0) {
    return 50; // Neutral score when no themes configured
  }

  let totalScore = 0;
  let totalWeight = 0;

  for (const theme of activeThemes) {
    // Score keyword clusters
    for (const clusterId of theme.keywordClusters) {
      const cluster = data.keywordClusters.find((kc) => kc.id === clusterId);
      if (!cluster) continue;

      const matchingKeywords = cluster.keywords.filter((kw) =>
        tags.some((tag) => tag.toLowerCase().includes(kw.toLowerCase())),
      );

      if (matchingKeywords.length > 0) {
        const matchRatio = matchingKeywords.length / cluster.keywords.length;
        const clusterScore = matchRatio * cluster.weight;
        totalScore += clusterScore;
        totalWeight += cluster.weight;
      }
    }

    // Score strategic priorities
    for (const priorityId of theme.strategicPriorities) {
      const priority = data.strategicPriorities.find((sp) => sp.id === priorityId);
      if (!priority) continue;

      const matchesPriority = tags.some((tag) =>
        tag.toLowerCase().includes(priority.name.toLowerCase()),
      );

      if (matchesPriority) {
        totalScore += priority.weight;
        totalWeight += priority.weight;
      }
    }

    // Apply exclude rules - zero out score if excluded
    for (const rule of theme.matchingPolicy.excludeRules) {
      for (const tag of tags) {
        if (matchesExclusionRule(tag, rule)) {
          return 0;
        }
      }
    }
  }

  if (totalWeight === 0) return 50;

  const normalizedScore = Math.round((totalScore / totalWeight) * 100);
  return Math.min(100, Math.max(0, normalizedScore));
}

/**
 * Checks if a given text matches an exclusion rule.
 */
export function matchesExclusionRule(
  text: string,
  rule: InclusionExclusionRule,
): boolean {
  const lowerText = text.toLowerCase();
  const lowerValue = rule.value.toLowerCase();

  switch (rule.operator) {
    case 'contains':
      return lowerText.includes(lowerValue);
    case 'equals':
      return lowerText === lowerValue;
    case 'startsWith':
      return lowerText.startsWith(lowerValue);
    case 'regex':
      try {
        return new RegExp(rule.value, 'i').test(text);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Determines if auto-draft should be triggered for a given fit score.
 */
export async function shouldAutoDraft(fitScore: number): Promise<boolean> {
  const policy = await getMatchingPolicy();
  return fitScore >= policy.autoDraftThreshold;
}
