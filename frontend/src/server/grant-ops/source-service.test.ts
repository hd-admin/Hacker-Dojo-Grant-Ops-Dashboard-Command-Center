import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withTempDataDir } from '../../../../shared/grant-ops-persistence';
import { resetDependencies } from './dependencies';
import * as sourceService from './source-service';

describe('SourceService', () => {
  let tempDataDir: Awaited<ReturnType<typeof withTempDataDir>>;

  beforeEach(async () => {
    tempDataDir = await withTempDataDir();
  });

  afterEach(async () => {
    resetDependencies();
    await tempDataDir.cleanup();
  });

  describe('Happy path', () => {
    it('addSource creates a source with correct name, url, type, and isActive=false when reviewStatus is pending-review', async () => {
      const result = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Source');
      expect(result.url).toBe('https://example.com/grants');
      expect(result.type).toBe('website');
      // New behavior: sources start with isActive=false and reviewStatus=pending-review until explicitly approved
      expect(result.isActive).toBe(false);
      expect(result.reviewStatus).toBe('pending-review');
      expect(result.createdAt).toBeDefined();
    });

    it('addSource creates a source with isActive=true when reviewStatus is approved', async () => {
      const result = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
        reviewStatus: 'approved',
      });

      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Source');
      expect(result.isActive).toBe(true);
      expect(result.reviewStatus).toBe('approved');
    });

    it('getAllSources returns all stored sources', async () => {
      await sourceService.addSource({
        name: 'Source 1',
        url: 'https://example.com/1',
        type: 'website',
      });
      await sourceService.addSource({
        name: 'Source 2',
        url: 'https://example.com/2',
        type: 'database',
      });

      const sources = await sourceService.getAllSources();

      expect(sources).toHaveLength(2);
      expect(sources.some((s) => s.name === 'Source 1')).toBe(true);
      expect(sources.some((s) => s.name === 'Source 2')).toBe(true);
    });

    it('removeSource removes the target source and leaves other sources intact', async () => {
      const source1 = await sourceService.addSource({
        name: 'Source 1',
        url: 'https://example.com/1',
        type: 'website',
      });
      const source2 = await sourceService.addSource({
        name: 'Source 2',
        url: 'https://example.com/2',
        type: 'website',
      });

      const result = await sourceService.removeSource(source1.id);

      expect(result).toBe(true);
      const remaining = await sourceService.getAllSources();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.id).toBe(source2.id);
    });

    it('activateSource sets isActive=true on a previously deactivated source and returns true', async () => {
      const source = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
      });

      await sourceService.deactivateSource(source.id);
      const result = await sourceService.activateSource(source.id);

      expect(result).toBe(true);
      const sources = await sourceService.getAllSources();
      const updatedSource = sources.find((s) => s.id === source.id)!;
      expect(updatedSource.isActive).toBe(true);
    });

    it('deactivateSource sets isActive=false on an active source and returns true', async () => {
      const source = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
      });

      const result = await sourceService.deactivateSource(source.id);

      expect(result).toBe(true);
      const sources = await sourceService.getAllSources();
      const updatedSource = sources.find((s) => s.id === source.id)!;
      expect(updatedSource.isActive).toBe(false);
    });

    it('getActiveSources returns only sources with isActive=true and reviewStatus approved', async () => {
      // Sources must be approved to be active for research
      const active1 = await sourceService.addSource({
        name: 'Active 1',
        url: 'https://example.com/1',
        type: 'website',
        reviewStatus: 'approved',
      });
      const active2 = await sourceService.addSource({
        name: 'Active 2',
        url: 'https://example.com/2',
        type: 'website',
        reviewStatus: 'approved',
      });
      // This source is approved but then deactivated
      const toDeactivate = await sourceService.addSource({
        name: 'To Deactivate',
        url: 'https://example.com/deactivate',
        type: 'website',
        reviewStatus: 'approved',
      });

      await sourceService.deactivateSource(toDeactivate.id);

      const activeSources = await sourceService.getActiveSources();

      expect(activeSources).toHaveLength(2);
      expect(activeSources.some((s) => s.id === active1.id)).toBe(true);
      expect(activeSources.some((s) => s.id === active2.id)).toBe(true);
      expect(activeSources.some((s) => s.id === toDeactivate.id)).toBe(false);
    });

    it('updateSourceLastCrawled sets lastCrawledAt to a non-null ISO string on the specified source and returns true', async () => {
      const source = await sourceService.addSource({
        name: 'Test Source',
        url: 'https://example.com/grants',
        type: 'website',
      });

      const result = await sourceService.updateSourceLastCrawled(source.id);

      expect(result).toBe(true);
      const sources = await sourceService.getAllSources();
      const updatedSource = sources.find((s) => s.id === source.id)!;
      expect(updatedSource.lastCrawledAt).toBeDefined();
      expect(typeof updatedSource.lastCrawledAt).toBe('string');
      expect(new Date(updatedSource.lastCrawledAt!).toISOString()).toBe(updatedSource.lastCrawledAt);
    });
  });

  describe('False return branches', () => {
    it('activateSource returns false when the source id does not exist', async () => {
      const result = await sourceService.activateSource('nonexistent-id');

      expect(result).toBe(false);
    });

    it('deactivateSource returns false when the source id does not exist', async () => {
      const result = await sourceService.deactivateSource('nonexistent-id');

      expect(result).toBe(false);
    });

    it('updateSourceLastCrawled returns false when the source id does not exist', async () => {
      const result = await sourceService.updateSourceLastCrawled('nonexistent-id');

      expect(result).toBe(false);
    });
  });
});
