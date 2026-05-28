/**
 * Theme Service Tests
 *
 * Tests CRUD for keyword clusters, themes, regions, populations,
 * strategic priorities, and matching policy configuration.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { invalidateCache, withTempDataDir } from '../../../../shared/grant-ops-persistence';
import type {
  KeywordCluster,
  Theme,
  Region,
  Population,
  StrategicPriority,
  MatchingPolicy,
  InclusionExclusionRule,
} from '../../../../shared/types';
import * as themeService from './theme-service';

function makeKeywordCluster(overrides: Partial<KeywordCluster> = {}): KeywordCluster {
  return {
    id: 'kc-1',
    name: 'STEM Education',
    keywords: ['STEM', 'science', 'technology', 'engineering', 'math'],
    weight: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRegion(overrides: Partial<Region> = {}): Region {
  return {
    id: 'reg-1',
    name: 'Bay Area',
    description: 'San Francisco Bay Area',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePopulation(overrides: Partial<Population> = {}): Population {
  return {
    id: 'pop-1',
    name: 'Youth',
    description: 'Ages 13-24',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeStrategicPriority(overrides: Partial<StrategicPriority> = {}): StrategicPriority {
  return {
    id: 'sp-1',
    name: 'Workforce Development',
    description: 'Building skills for the future workforce',
    weight: 70,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDefaultMatchingPolicy(): MatchingPolicy {
  return {
    matchThreshold: 70,
    autoDraftThreshold: 85,
    includeRules: [],
    excludeRules: [],
  };
}

function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    id: 'theme-1',
    name: 'Default Theme',
    description: 'Default matching theme',
    keywordClusters: [],
    regions: [],
    populations: [],
    strategicPriorities: [],
    matchingPolicy: makeDefaultMatchingPolicy(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeInclusionExclusionRule(overrides: Partial<InclusionExclusionRule> = {}): InclusionExclusionRule {
  return {
    id: 'rule-1',
    field: 'tags',
    operator: 'contains',
    value: 'STEM',
    priority: 1,
    ...overrides,
  };
}

describe('ThemeService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>> | null = null;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
    invalidateCache();
  });

  afterEach(async () => {
    if (tempDataDir) {
      await tempDataDir.cleanup();
      tempDataDir = null;
    }
    invalidateCache();
  });

  // ============ KEYWORD CLUSTER CRUD ============

  describe('KeywordCluster CRUD', () => {
    it('adds a keyword cluster', async () => {
      const cluster = makeKeywordCluster();
      const result = await themeService.addKeywordCluster(cluster);

      expect(result).toBeDefined();
      expect(result.id).toBe('kc-1');
      expect(result.name).toBe('STEM Education');
      expect(result.keywords).toContain('STEM');
    });

    it('gets all keyword clusters', async () => {
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-1', name: 'First' }));
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-2', name: 'Second' }));

      const clusters = await themeService.getKeywordClusters();
      expect(clusters).toHaveLength(2);
    });

    it('gets a keyword cluster by id', async () => {
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-1', name: 'My Cluster' }));

      const cluster = await themeService.getKeywordCluster('kc-1');
      expect(cluster).toBeDefined();
      expect(cluster?.name).toBe('My Cluster');
    });

    it('returns null for non-existent keyword cluster', async () => {
      const cluster = await themeService.getKeywordCluster('nonexistent');
      expect(cluster).toBeNull();
    });

    it('updates a keyword cluster', async () => {
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-1', name: 'Original' }));

      await themeService.updateKeywordCluster('kc-1', {
        name: 'Updated',
        keywords: ['new', 'keywords'],
      });

      const updated = await themeService.getKeywordCluster('kc-1');
      expect(updated?.name).toBe('Updated');
      expect(updated?.keywords).toEqual(['new', 'keywords']);
    });

    it('throws when updating non-existent keyword cluster', async () => {
      await expect(
        themeService.updateKeywordCluster('nonexistent', { name: 'X' }),
      ).rejects.toThrow(/not found/i);
    });

    it('removes a keyword cluster', async () => {
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-1' }));
      await themeService.addKeywordCluster(makeKeywordCluster({ id: 'kc-2' }));

      await themeService.removeKeywordCluster('kc-1');

      const clusters = await themeService.getKeywordClusters();
      expect(clusters).toHaveLength(1);
      expect(clusters[0]?.id).toBe('kc-2');
    });
  });

  // ============ REGION CRUD ============

  describe('Region CRUD', () => {
    it('adds a region', async () => {
      const region = makeRegion();
      const result = await themeService.addRegion(region);
      expect(result.name).toBe('Bay Area');
    });

    it('gets all regions', async () => {
      await themeService.addRegion(makeRegion({ id: 'reg-1', name: 'Bay Area' }));
      await themeService.addRegion(makeRegion({ id: 'reg-2', name: 'Los Angeles' }));

      const regions = await themeService.getRegions();
      expect(regions).toHaveLength(2);
    });

    it('gets a region by id', async () => {
      await themeService.addRegion(makeRegion({ id: 'reg-1', name: 'Bay Area' }));
      const region = await themeService.getRegion('reg-1');
      expect(region?.name).toBe('Bay Area');
    });

    it('updates a region', async () => {
      await themeService.addRegion(makeRegion({ id: 'reg-1', name: 'Old Name' }));
      await themeService.updateRegion('reg-1', { name: 'New Name' });
      const updated = await themeService.getRegion('reg-1');
      expect(updated?.name).toBe('New Name');
    });

    it('removes a region', async () => {
      await themeService.addRegion(makeRegion({ id: 'reg-1' }));
      await themeService.addRegion(makeRegion({ id: 'reg-2' }));

      await themeService.removeRegion('reg-1');
      const regions = await themeService.getRegions();
      expect(regions).toHaveLength(1);
    });
  });

  // ============ POPULATION CRUD ============

  describe('Population CRUD', () => {
    it('adds a population', async () => {
      const population = makePopulation();
      const result = await themeService.addPopulation(population);
      expect(result.name).toBe('Youth');
    });

    it('gets all populations', async () => {
      await themeService.addPopulation(makePopulation({ id: 'pop-1' }));
      await themeService.addPopulation(makePopulation({ id: 'pop-2' }));

      const populations = await themeService.getPopulations();
      expect(populations).toHaveLength(2);
    });

    it('gets a population by id', async () => {
      await themeService.addPopulation(makePopulation({ id: 'pop-1', name: 'Youth' }));
      const population = await themeService.getPopulation('pop-1');
      expect(population?.name).toBe('Youth');
    });

    it('updates a population', async () => {
      await themeService.addPopulation(makePopulation({ id: 'pop-1', name: 'Old' }));
      await themeService.updatePopulation('pop-1', { name: 'New' });
      const updated = await themeService.getPopulation('pop-1');
      expect(updated?.name).toBe('New');
    });

    it('removes a population', async () => {
      await themeService.addPopulation(makePopulation({ id: 'pop-1' }));
      await themeService.addPopulation(makePopulation({ id: 'pop-2' }));

      await themeService.removePopulation('pop-1');
      const populations = await themeService.getPopulations();
      expect(populations).toHaveLength(1);
    });
  });

  // ============ STRATEGIC PRIORITY CRUD ============

  describe('StrategicPriority CRUD', () => {
    it('adds a strategic priority', async () => {
      const priority = makeStrategicPriority();
      const result = await themeService.addStrategicPriority(priority);
      expect(result.name).toBe('Workforce Development');
    });

    it('gets all strategic priorities', async () => {
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-1' }));
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-2' }));

      const priorities = await themeService.getStrategicPriorities();
      expect(priorities).toHaveLength(2);
    });

    it('gets a strategic priority by id', async () => {
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-1', name: 'Priority 1' }));
      const priority = await themeService.getStrategicPriority('sp-1');
      expect(priority?.name).toBe('Priority 1');
    });

    it('updates a strategic priority', async () => {
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-1', name: 'Old' }));
      await themeService.updateStrategicPriority('sp-1', { name: 'New', weight: 90 });
      const updated = await themeService.getStrategicPriority('sp-1');
      expect(updated?.name).toBe('New');
      expect(updated?.weight).toBe(90);
    });

    it('removes a strategic priority', async () => {
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-1' }));
      await themeService.addStrategicPriority(makeStrategicPriority({ id: 'sp-2' }));

      await themeService.removeStrategicPriority('sp-1');
      const priorities = await themeService.getStrategicPriorities();
      expect(priorities).toHaveLength(1);
    });
  });

  // ============ THEME CRUD ============

  describe('Theme CRUD', () => {
    it('adds a theme', async () => {
      const theme = makeTheme({ id: 'theme-1', name: 'Education Focus' });
      const result = await themeService.addTheme(theme);
      expect(result.name).toBe('Education Focus');
      expect(result.isActive).toBe(true);
    });

    it('gets all themes', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', name: 'First' }));
      await themeService.addTheme(makeTheme({ id: 'theme-2', name: 'Second' }));

      const themes = await themeService.getThemes();
      expect(themes).toHaveLength(2);
    });

    it('gets a theme by id', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', name: 'My Theme' }));
      const theme = await themeService.getTheme('theme-1');
      expect(theme?.name).toBe('My Theme');
    });

    it('returns null for non-existent theme', async () => {
      const theme = await themeService.getTheme('nonexistent');
      expect(theme).toBeNull();
    });

    it('updates a theme', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', name: 'Original' }));
      await themeService.updateTheme('theme-1', { name: 'Updated', isActive: false });

      const updated = await themeService.getTheme('theme-1');
      expect(updated?.name).toBe('Updated');
      expect(updated?.isActive).toBe(false);
    });

    it('removes a theme', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1' }));
      await themeService.addTheme(makeTheme({ id: 'theme-2' }));

      await themeService.removeTheme('theme-1');

      const themes = await themeService.getThemes();
      expect(themes).toHaveLength(1);
      expect(themes[0]?.id).toBe('theme-2');
    });

    it('gets active themes only', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', name: 'Active', isActive: true }));
      await themeService.addTheme(makeTheme({ id: 'theme-2', name: 'Inactive', isActive: false }));

      const active = await themeService.getActiveThemes();
      expect(active).toHaveLength(1);
      expect(active[0]?.name).toBe('Active');
    });
  });

  // ============ MATCHING POLICY ============

  describe('Matching Policy', () => {
    it('getMatchingPolicy returns default when no theme exists', async () => {
      const policy = await themeService.getMatchingPolicy();
      expect(policy.matchThreshold).toBe(70);
      expect(policy.autoDraftThreshold).toBe(85);
    });

    it('getMatchingPolicy returns active theme policy', async () => {
      const customPolicy: MatchingPolicy = {
        matchThreshold: 60,
        autoDraftThreshold: 80,
        includeRules: [],
        excludeRules: [],
      };
      await themeService.addTheme(makeTheme({
        id: 'theme-1',
        matchingPolicy: customPolicy,
        isActive: true,
      }));

      const policy = await themeService.getMatchingPolicy();
      expect(policy.matchThreshold).toBe(60);
      expect(policy.autoDraftThreshold).toBe(80);
    });

    it('updateMatchingPolicy updates active theme thresholds', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', isActive: true }));

      await themeService.updateMatchingPolicy({
        matchThreshold: 55,
        autoDraftThreshold: 75,
      });

      const policy = await themeService.getMatchingPolicy();
      expect(policy.matchThreshold).toBe(55);
      expect(policy.autoDraftThreshold).toBe(75);
    });

    it('addIncludeRule adds an include rule to active theme', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', isActive: true }));

      const rule = makeInclusionExclusionRule({ id: 'rule-1', field: 'tags', operator: 'contains', value: 'STEM' });
      await themeService.addIncludeRule(rule);

      const policy = await themeService.getMatchingPolicy();
      expect(policy.includeRules).toHaveLength(1);
      expect(policy.includeRules[0]?.value).toBe('STEM');
    });

    it('addExcludeRule adds an exclude rule to active theme', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', isActive: true }));

      const rule = makeInclusionExclusionRule({ id: 'rule-2', field: 'funder', operator: 'equals', value: 'ScamCorp' });
      await themeService.addExcludeRule(rule);

      const policy = await themeService.getMatchingPolicy();
      expect(policy.excludeRules).toHaveLength(1);
      expect(policy.excludeRules[0]?.value).toBe('ScamCorp');
    });

    it('removeIncludeRule removes an include rule', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', isActive: true }));
      await themeService.addIncludeRule(makeInclusionExclusionRule({ id: 'rule-1', value: 'test' }));

      await themeService.removeIncludeRule('rule-1');

      const policy = await themeService.getMatchingPolicy();
      expect(policy.includeRules).toHaveLength(0);
    });

    it('removeExcludeRule removes an exclude rule', async () => {
      await themeService.addTheme(makeTheme({ id: 'theme-1', isActive: true }));
      await themeService.addExcludeRule(makeInclusionExclusionRule({ id: 'rule-1', value: 'test' }));

      await themeService.removeExcludeRule('rule-1');

      const policy = await themeService.getMatchingPolicy();
      expect(policy.excludeRules).toHaveLength(0);
    });
  });

  // ============ SCORING HELPERS ============

  describe('scoring helpers', () => {
    it('scoreGrantByThemes returns base 50 when no themes exist', async () => {
      const score = await themeService.scoreGrantByThemes([]);
      expect(score).toBe(50);
    });

    it('scoreGrantByThemes boosts score for matching keywords', async () => {
      const cluster = makeKeywordCluster({
        id: 'kc-1',
        keywords: ['STEM', 'education', 'technology'],
        weight: 80,
      });
      await themeService.addKeywordCluster(cluster);
      await themeService.addTheme(makeTheme({
        id: 'theme-1',
        keywordClusters: ['kc-1'],
        isActive: true,
      }));

      const score = await themeService.scoreGrantByThemes(['STEM', 'education']);
      expect(score).toBeGreaterThan(50);
    });

    it('scoreGrantByThemes applies strategic priority weights', async () => {
      const priority = makeStrategicPriority({ id: 'sp-1', name: 'Workforce', weight: 90 });
      await themeService.addStrategicPriority(priority);
      await themeService.addTheme(makeTheme({
        id: 'theme-1',
        strategicPriorities: ['sp-1'],
        isActive: true,
      }));

      const score = await themeService.scoreGrantByThemes(['workforce', 'development']);
      expect(score).toBeGreaterThan(50);
    });

    it('matchesExcludeRule returns true when tag matches exclude rule', async () => {
      const rule = makeInclusionExclusionRule({
        id: 'rule-1',
        field: 'tags',
        operator: 'contains',
        value: 'scam',
      });

      const matches = themeService.matchesExclusionRule('scam grant', rule);
      expect(matches).toBe(true);
    });

    it('matchesExcludeRule returns false when tag does not match', async () => {
      const rule = makeInclusionExclusionRule({
        id: 'rule-1',
        field: 'tags',
        operator: 'contains',
        value: 'scam',
      });

      const matches = themeService.matchesExclusionRule('legit grant', rule);
      expect(matches).toBe(false);
    });

    it('shouldAutoDraft returns false when fit is below threshold', async () => {
      await themeService.addTheme(makeTheme({
        id: 'theme-1',
        matchingPolicy: { ...makeDefaultMatchingPolicy(), autoDraftThreshold: 80 },
        isActive: true,
      }));

      const result = await themeService.shouldAutoDraft(60);
      expect(result).toBe(false);
    });

    it('shouldAutoDraft returns true when fit is above threshold', async () => {
      await themeService.addTheme(makeTheme({
        id: 'theme-1',
        matchingPolicy: { ...makeDefaultMatchingPolicy(), autoDraftThreshold: 80 },
        isActive: true,
      }));

      const result = await themeService.shouldAutoDraft(85);
      expect(result).toBe(true);
    });
  });
});
