/**
 * Award Service
 *
 * Manages post-award operations: awards, budget categories, expenses,
 * planned expenses, reporting deadlines, and compliance items.
 * Backed by SQLite for persistent storage via shared/grant-ops-persistence.ts.
 */

import type {
  Award,
  AwardBudgetCategory,
  AwardComplianceItem,
  AwardExpense,
  AwardReportDeadline,
  PlannedExpense,
} from '../../../../shared/types';
import {
  loadAwards,
  saveAwards,
  loadAwardBudgetCategories,
  saveAwardBudgetCategories,
  loadAwardExpenses,
  saveAwardExpenses,
  loadPlannedExpenses,
  savePlannedExpenses,
  loadAwardReportDeadlines,
  saveAwardReportDeadlines,
  loadAwardComplianceItems,
  saveAwardComplianceItems,
} from '../../../../shared/grant-ops-persistence';
import { getDependencies } from './dependencies';

let initialized = false;

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  // Preload from SQLite to warm the data into memory for fast read access.
  // The SQLite layer handles the actual persistence; we load the latest state.
  initialized = true;
}

export async function createAward(
  grantId: string,
  amount: number,
  startDate: string,
  endDate: string,
): Promise<Award> {
  await ensureInitialized();
  const deps = getDependencies();
  const awards = await loadAwards();
  const award: Award = {
    id: deps.idGenerator.generateId('award'),
    grantId,
    funder: '',
    title: '',
    amount,
    startDate,
    endDate,
    status: 'active',
    awardLetterPath: '',
    notes: '',
    createdAt: deps.clock.now().toISOString(),
    updatedAt: deps.clock.now().toISOString(),
  };
  awards.push(award);
  await saveAwards(awards);
  return award;
}

export async function getAwards(): Promise<Award[]> {
  await ensureInitialized();
  return loadAwards();
}

export async function getAward(awardId: string): Promise<Award | null> {
  const awards = await loadAwards();
  return awards.find(a => a.id === awardId) || null;
}

export async function updateAward(awardId: string, updates: Partial<Award>): Promise<Award | null> {
  const awards = await loadAwards();
  const index = awards.findIndex(a => a.id === awardId);
  if (index === -1) return null;
  awards[index] = { ...awards[index], ...updates, updatedAt: new Date().toISOString() } as Award;
  await saveAwards(awards);
  return awards[index];
}

export async function createBudgetCategory(
  awardId: string,
  category: string,
  budgeted: number,
  restrictions?: string,
): Promise<AwardBudgetCategory> {
  await ensureInitialized();
  const deps = getDependencies();
  const categories = await loadAwardBudgetCategories();
  const cat: AwardBudgetCategory = {
    id: deps.idGenerator.generateId('budcat'),
    awardId,
    category,
    budgeted,
    spent: 0,
    ...(restrictions !== undefined ? { restrictions } : {}),
  };
  categories.push(cat);
  await saveAwardBudgetCategories(categories);
  return cat;
}

export async function getBudgetCategories(awardId: string): Promise<AwardBudgetCategory[]> {
  const categories = await loadAwardBudgetCategories();
  return categories.filter(c => c.awardId === awardId);
}

export async function addExpense(
  awardId: string,
  categoryId: string,
  date: string,
  description: string,
  amount: number,
  receipt?: string,
): Promise<AwardExpense> {
  await ensureInitialized();
  const deps = getDependencies();
  const expenses = await loadAwardExpenses();
  const expense: AwardExpense = {
    id: deps.idGenerator.generateId('exp'),
    awardId,
    categoryId,
    date,
    description,
    amount,
    ...(receipt !== undefined ? { receipt } : {}),
  };
  expenses.push(expense);
  await saveAwardExpenses(expenses);

  const categories = await loadAwardBudgetCategories();
  const catIndex = categories.findIndex(c => c.id === categoryId);
  if (catIndex !== -1) {
    categories[catIndex]!.spent += amount;
    await saveAwardBudgetCategories(categories);
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
  await ensureInitialized();
  const deps = getDependencies();
  const plannedExpenses = await loadPlannedExpenses();
  const pe: PlannedExpense = {
    id: deps.idGenerator.generateId('plan'),
    awardId,
    categoryId,
    date,
    description,
    amount,
  };
  plannedExpenses.push(pe);
  await savePlannedExpenses(plannedExpenses);
  return pe;
}

export async function addReportDeadline(
  awardId: string,
  reportType: string,
  dueDate: string,
): Promise<AwardReportDeadline> {
  await ensureInitialized();
  const deps = getDependencies();
  const deadlines = await loadAwardReportDeadlines();
  const d: AwardReportDeadline = {
    id: deps.idGenerator.generateId('rpt'),
    awardId,
    reportType,
    dueDate,
    status: 'pending',
  };
  deadlines.push(d);
  await saveAwardReportDeadlines(deadlines);
  return d;
}

export async function getReportDeadlines(awardId: string): Promise<AwardReportDeadline[]> {
  const deadlines = await loadAwardReportDeadlines();
  return deadlines.filter(d => d.awardId === awardId);
}

export async function addComplianceItem(
  awardId: string,
  requirement: string,
  dueDate?: string,
): Promise<AwardComplianceItem> {
  await ensureInitialized();
  const deps = getDependencies();
  const items = await loadAwardComplianceItems();
  const item: AwardComplianceItem = {
    id: deps.idGenerator.generateId('comp'),
    awardId,
    requirement,
    dueDate: dueDate || '',
    status: 'pending',
  };
  items.push(item);
  await saveAwardComplianceItems(items);
  return item;
}

export async function getComplianceItems(awardId: string): Promise<AwardComplianceItem[]> {
  const items = await loadAwardComplianceItems();
  return items.filter(c => c.awardId === awardId);
}

export async function getSpendDownAlerts(): Promise<{ awardId: string; type: 'under' | 'over'; category: string }[]> {
  const alerts: { awardId: string; type: 'under' | 'over'; category: string }[] = [];

  const awards = await loadAwards();
  const categories = await loadAwardBudgetCategories();

  for (const award of awards) {
    if (award.status !== 'active') continue;

    const awardCats = categories.filter(c => c.awardId === award.id);
    const now = new Date();
    const start = new Date(award.startDate);
    const end = new Date(award.endDate);
    const periodProgress = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));

    for (const cat of awardCats) {
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

export async function resetAwardCache(): Promise<void> {
  // Clear all award-related tables via SQLite
  await saveAwards([]);
  await saveAwardBudgetCategories([]);
  await saveAwardExpenses([]);
  await savePlannedExpenses([]);
  await saveAwardReportDeadlines([]);
  await saveAwardComplianceItems([]);
  initialized = false;
}
