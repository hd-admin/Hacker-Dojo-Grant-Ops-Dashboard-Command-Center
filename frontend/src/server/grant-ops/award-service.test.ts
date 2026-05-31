import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeBudgetVsActual,
  getComplianceCalendar,
  createAward,
  createBudgetCategory,
  addExpense,
  addReportDeadline,
  addComplianceItem,
  resetAwardCache,
} from './award-service';

const mockStore: Record<string, unknown[]> = {
  awards: [],
  budgetCategories: [],
  expenses: [],
  plannedExpenses: [],
  reportDeadlines: [],
  complianceItems: [],
};

vi.mock('../../../../shared/grant-ops-persistence', () => ({
  loadAwards: vi.fn(() => Promise.resolve(mockStore.awards)),
  saveAwards: vi.fn((data: unknown[]) => { mockStore.awards = data; return Promise.resolve(); }),
  loadAwardBudgetCategories: vi.fn(() => Promise.resolve(mockStore.budgetCategories)),
  saveAwardBudgetCategories: vi.fn((data: unknown[]) => { mockStore.budgetCategories = data; return Promise.resolve(); }),
  loadAwardExpenses: vi.fn(() => Promise.resolve(mockStore.expenses)),
  saveAwardExpenses: vi.fn((data: unknown[]) => { mockStore.expenses = data; return Promise.resolve(); }),
  loadPlannedExpenses: vi.fn(() => Promise.resolve(mockStore.plannedExpenses)),
  savePlannedExpenses: vi.fn((data: unknown[]) => { mockStore.plannedExpenses = data; return Promise.resolve(); }),
  loadAwardReportDeadlines: vi.fn(() => Promise.resolve(mockStore.reportDeadlines)),
  saveAwardReportDeadlines: vi.fn((data: unknown[]) => { mockStore.reportDeadlines = data; return Promise.resolve(); }),
  loadAwardComplianceItems: vi.fn(() => Promise.resolve(mockStore.complianceItems)),
  saveAwardComplianceItems: vi.fn((data: unknown[]) => { mockStore.complianceItems = data; return Promise.resolve(); }),
}));
vi.mock('./dependencies', () => ({
  getDependencies: () => ({
    idGenerator: { generateId: (prefix: string) => `${prefix}-test-id` },
    clock: { now: () => new Date('2026-06-01T00:00:00Z') },
  }),
}));

describe('award-service', () => {
  beforeEach(async () => {
    mockStore.awards = [];
    mockStore.budgetCategories = [];
    mockStore.expenses = [];
    mockStore.plannedExpenses = [];
    mockStore.reportDeadlines = [];
    mockStore.complianceItems = [];
    await resetAwardCache();
  });

  describe('computeBudgetVsActual', () => {
    it('calculates green status when within 10% of timeline target', async () => {
      const award = await createAward('g1', 100000, '2026-01-01', '2026-12-31');
      const cat = await createBudgetCategory(award.id, 'Personnel', 50000);
      await addExpense(award.id, cat.id, '2026-05-01', 'Salary', 20000);

      const rows = await computeBudgetVsActual(award.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('green');
    });

    it('calculates yellow status when 11-25% off target', async () => {
      const award = await createAward('g1', 100000, '2026-01-01', '2026-12-31');
      const cat = await createBudgetCategory(award.id, 'Personnel', 50000);
      await addExpense(award.id, cat.id, '2026-05-01', 'Salary', 23000);

      const rows = await computeBudgetVsActual(award.id);
      expect(rows[0]!.status).toBe('yellow');
    });

    it('calculates red status when over 25% off', async () => {
      const award = await createAward('g1', 100000, '2026-01-01', '2026-12-31');
      const cat = await createBudgetCategory(award.id, 'Personnel', 50000);
      await addExpense(award.id, cat.id, '2026-05-01', 'Salary', 50000);

      const rows = await computeBudgetVsActual(award.id);
      expect(rows[0]!.status).toBe('red');
    });
  });

  describe('getComplianceCalendar', () => {
    it('returns sorted events with color coding', async () => {
      const award = await createAward('g1', 100000, '2026-01-01', '2026-12-31');
      await addReportDeadline(award.id, 'Annual Report', '2026-06-20');
      await addComplianceItem(award.id, 'Financial Audit', '2026-06-10');

      const events = await getComplianceCalendar();
      expect(events).toHaveLength(2);
      expect(events[0]!.dueDate).toBe('2026-06-10');
      expect(events[1]!.dueDate).toBe('2026-06-20');
    });
  });
});
