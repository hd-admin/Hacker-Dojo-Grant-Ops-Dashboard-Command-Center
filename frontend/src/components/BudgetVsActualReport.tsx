'use client';

import React, { useMemo } from 'react';
import type { Award, AwardBudgetCategory, AwardExpense } from '../../../shared/types';

interface BudgetVsActualReportProps {
  award: Award;
  budgetCategories: AwardBudgetCategory[];
  expenses: AwardExpense[];
  periodStart: string;
  periodEnd: string;
}

function getVarianceColor(spentPercent: number, periodPercent: number): string {
  const diff = spentPercent - periodPercent;
  if (Math.abs(diff) <= 10) return 'var(--success)';
  if (Math.abs(diff) <= 25) return 'var(--warning)';
  return 'var(--danger)';
}

function getPeriodProgress(startDate: string, endDate: string): number {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 100;
  const elapsed = now.getTime() - start.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

export function BudgetVsActualReport({
  award,
  budgetCategories,
  expenses,
  periodStart,
  periodEnd,
}: BudgetVsActualReportProps) {
  const periodPercent = getPeriodProgress(periodStart, periodEnd);

  const rows = useMemo(() => {
    return budgetCategories.map((cat) => {
      const catExpenses = expenses.filter((e) => e.categoryId === cat.id);
      const totalSpent = catExpenses.reduce((sum, e) => sum + e.amount, 0);
      const spentPercent = cat.budgeted > 0 ? Math.round((totalSpent / cat.budgeted) * 100) : 0;
      const variance = spentPercent - periodPercent;
      const color = getVarianceColor(spentPercent, periodPercent);
      return {
        category: cat.category,
        budgeted: cat.budgeted,
        spent: totalSpent,
        spentPercent,
        periodPercent,
        variance,
        color,
        internalCategory: cat.internalCategory,
      };
    });
  }, [budgetCategories, expenses, periodPercent]);

  const totalBudgeted = rows.reduce((sum, r) => sum + r.budgeted, 0);
  const totalSpent = rows.reduce((sum, r) => sum + r.spent, 0);

  const exportCsv = () => {
    const headers = ['Category', 'Budgeted', 'Spent', '% Spent', 'Timeline %', 'Variance', 'On Track'];
    const csvRows = [headers.join(',')];
    rows.forEach((r) => {
      csvRows.push([
        `"${r.category}"`,
        r.budgeted,
        r.spent,
        `${r.spentPercent}%`,
        `${r.periodPercent}%`,
        `${r.variance > 0 ? '+' : ''}${r.variance}%`,
        Math.abs(r.variance) <= 10 ? 'Yes' : 'No',
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-vs-actual-${award.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="budget-vs-actual" data-testid="budget-vs-actual-report">
      <div className="budget-vs-actual-header">
        <div>
          <h3>Budget vs. Actual Report</h3>
          <div className="text-dim">Award: {award.grantId} | Period: {periodStart} — {periodEnd} ({periodPercent}% elapsed)</div>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={exportCsv}>
          Export CSV
        </button>
      </div>

      <div className="budget-vs-actual-summary">
        <span>Total Budgeted: ${totalBudgeted.toLocaleString()}</span>
        <span>Total Spent: ${totalSpent.toLocaleString()}</span>
        <span>Remaining: ${(totalBudgeted - totalSpent).toLocaleString()}</span>
      </div>

      <table className="budget-vs-actual-table" role="table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Budgeted</th>
            <th>Spent</th>
            <th>% Spent</th>
            <th>Timeline %</th>
            <th>Variance</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.category}{row.internalCategory ? ` → ${row.internalCategory}` : ''}</td>
              <td className="mono">${row.budgeted.toLocaleString()}</td>
              <td className="mono">${row.spent.toLocaleString()}</td>
              <td>
                <div className="budget-vs-actual-bar-container">
                  <div
                    className="budget-vs-actual-bar"
                    style={{ transform: `scaleX(${row.spentPercent / 100})`, transformOrigin: 'left', background: row.color }}
                  />
                  <span>{row.spentPercent}%</span>
                </div>
              </td>
              <td className="mono">{row.periodPercent}%</td>
              <td className="mono" style={{ color: row.color }}>
                {row.variance > 0 ? '+' : ''}{row.variance}%
              </td>
              <td>
                <span
                  className={`status-badge status-badge-${Math.abs(row.variance) <= 10 ? 'success' : Math.abs(row.variance) <= 25 ? 'warning' : 'danger'}`}
                >
                  {Math.abs(row.variance) <= 10 ? 'On Track' : Math.abs(row.variance) <= 25 ? 'Watch' : 'Off Track'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

