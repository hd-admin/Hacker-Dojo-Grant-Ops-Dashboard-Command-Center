/**
 * Award Service
 *
 * Manages post-award operations: awards, budget categories, expenses,
 * planned expenses, reporting deadlines, and compliance items.
 * Uses in-memory storage backed by the repository for phase 1.
 */

import type {
  Award,
  AwardBudgetCategory,
  AwardComplianceItem,
  AwardExpense,
  AwardReportDeadline,
  PlannedExpense,
} from '../../../../shared/types';
import { getDependencies } from './dependencies';

let awardsCache: Award[] = [];
let budgetCategoriesCache: AwardBudgetCategory[] = [];
let expensesCache: AwardExpense[] = [];
let plannedExpensesCache: PlannedExpense[] = [];
let reportDeadlinesCache: AwardReportDeadline[] = [];
let complianceItemsCache: AwardComplianceItem[] = [];

export async function createAward(
  grantId: string,
  amount: string,
  startDate: string,
  endDate: string,
): Promise<Award> {
  const deps = getDependencies();
  const award: Award = {
    id: deps.idGenerator.generateId('award'),
    grantId,
    amount,
    startDate,
    endDate,
    status: 'active',
    createdAt: deps.clock.now().toISOString(),
    updatedAt: deps.clock.now().toISOString(),
  };
  awardsCache.push(award);
  return award;
}

export async function getAwards(): Promise<Award[]> {
  return [...awardsCache];
}

export async function getAward(awardId: string): Promise<Award | null> {
  return awardsCache.find(a => a.id === awardId) || null;
}

export async function updateAward(awardId: string, updates: Partial<Award>): Promise<Award | null> {
  const index = awardsCache.findIndex(a => a.id === awardId);
  if (index === -1) return null;
  awardsCache[index] = { ...awardsCache[index], ...updates, updatedAt: new Date().toISOString() } as Award;
  return awardsCache[index];
}

export async function createBudgetCategory(
  awardId: string,
  category: string,
  budgeted: number,
  restrictions?: string,
): Promise<AwardBudgetCategory> {
  const deps = getDependencies();
  const cat: AwardBudgetCategory = {
    id: deps.idGenerator.generateId('budcat'),
    awardId,
    category,
    budgeted,
    spent: 0,
    ...(restrictions !== undefined ? { restrictions } : {}),
  };
  budgetCategoriesCache.push(cat);
  return cat;
}

export async function getBudgetCategories(awardId: string): Promise<AwardBudgetCategory[]> {
  return budgetCategoriesCache.filter(c => c.awardId === awardId);
}

export async function addExpense(
  awardId: string,
  categoryId: string,
  date: string,
  description: string,
  amount: number,
  receipt?: string,
): Promise<AwardExpense> {
  const deps = getDependencies();
  const expense: AwardExpense = {
    id: deps.idGenerator.generateId('exp'),
    awardId,
    categoryId,
    date,
    description,
    amount,
    ...(receipt !== undefined ? { receipt } : {}),
  };
  expensesCache.push(expense);

  const catIndex = budgetCategoriesCache.findIndex(c => c.id === categoryId);
  if (catIndex !== -1) {
    budgetCategoriesCache[catIndex]!.spent += amount;
  }

  return expense;
}

export async function addPlannedExpense(
  awardId: string,
  categoryId: string,
  date: string,
  description: string,
  amount: number,
): Promise<PlannedExpense> {
  const deps = getDependencies();
  const pe: PlannedExpense = {
    id: deps.idGenerator.generateId('plan'),
    awardId,
    categoryId,
    date,
    description,
    amount,
  };
  plannedExpensesCache.push(pe);
  return pe;
}

export async function addReportDeadline(
  awardId: string,
  type: string,
  dueDate: string,
  format?: string,
): Promise<AwardReportDeadline> {
  const deps = getDependencies();
  const d: AwardReportDeadline = {
    id: deps.idGenerator.generateId('rpt'),
    awardId,
    type,
    dueDate,
    ...(format !== undefined ? { format } : {}),
    status: 'pending',
  };
  reportDeadlinesCache.push(d);
  return d;
}

export async function getReportDeadlines(awardId: string): Promise<AwardReportDeadline[]> {
  return reportDeadlinesCache.filter(d => d.awardId === awardId);
}

export async function addComplianceItem(
  awardId: string,
  requirement: string,
  dueDate?: string,
): Promise<AwardComplianceItem> {
  const deps = getDependencies();
  const item: AwardComplianceItem = {
    id: deps.idGenerator.generateId('comp'),
    awardId,
    requirement,
    ...(dueDate !== undefined ? { dueDate } : {}),
    status: 'pending',
  };
  complianceItemsCache.push(item);
  return item;
}

export async function getComplianceItems(awardId: string): Promise<AwardComplianceItem[]> {
  return complianceItemsCache.filter(c => c.awardId === awardId);
}

export async function getSpendDownAlerts(): Promise<{ awardId: string; type: 'under' | 'over'; category: string }[]> {
  const alerts: { awardId: string; type: 'under' | 'over'; category: string }[] = [];

  for (const award of awardsCache) {
    if (award.status !== 'active') continue;

    const categories = budgetCategoriesCache.filter(c => c.awardId === award.id);
    const now = new Date();
    const start = new Date(award.startDate);
    const end = new Date(award.endDate);
    const periodProgress = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));

    for (const cat of categories) {
      if (cat.budgeted <= 0) continue;
      const spentPct = cat.spent / cat.budgeted;
      if (spentPct < periodProgress * 0.4) {
        alerts.push({ awardId: award.id, type: 'under', category: cat.category });
      }
      if (spentPct > 0.95 && periodProgress < 0.8) {
        alerts.push({ awardId: award.id, type: 'over', category: cat.category });
      }
    }
  }

  return alerts;
}

export function resetAwardCache(): void {
  awardsCache = [];
  budgetCategoriesCache = [];
  expensesCache = [];
  plannedExpensesCache = [];
  reportDeadlinesCache = [];
  complianceItemsCache = [];
}
