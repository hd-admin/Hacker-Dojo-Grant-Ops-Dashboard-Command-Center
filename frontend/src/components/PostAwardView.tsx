'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type {
  Award,
  AwardBudgetCategory,
  AwardComplianceItem,
  AwardExpense,
  AwardReportDeadline,
  PlannedExpense,
} from '../../../shared/types';

interface PostAwardViewProps {
  onRefreshAppState?: () => Promise<void> | void;
}

export default function PostAwardView({ onRefreshAppState: _onRefreshAppState }: PostAwardViewProps) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [_budgetCategories, _setBudgetCategories] = useState<Record<string, AwardBudgetCategory[]>>({});
  const [_expenses, _setExpenses] = useState<Record<string, AwardExpense[]>>({});
  const [_reportDeadlines, _setReportDeadlines] = useState<Record<string, AwardReportDeadline[]>>({});
  const [_complianceItems, _setComplianceItems] = useState<Record<string, AwardComplianceItem[]>>({});
  const [_plannedExpenses, _setPlannedExpenses] = useState<Record<string, PlannedExpense[]>>({});
  const [alerts, setAlerts] = useState<{ awardId: string; type: 'under' | 'over'; category: string }[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Array<{ awardId: string; awardTitle: string; type: string; title: string; dueDate: string; status: string; color: string }>>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<Record<string, Array<{ category: string; budgeted: number; spent: number; planned: number; status: string }>>>({});
  const [loading, setLoading] = useState(true);
  const [expandedAward, setExpandedAward] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({ date: '', description: '', amount: '', category: '' });
  const [plannedForm, setPlannedForm] = useState({ date: '', description: '', amount: '', category: '' });
  const [showAddPlanned, setShowAddPlanned] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [_error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'awards' | 'calendar' | 'budget'>('awards');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  const loadData = useCallback(async () => {
    try {
      const [awardsRes, alertsRes, calendarRes] = await Promise.all([
        fetch('/api/awards').then((r) => r.json()).catch(() => ({ awards: [] })),
        fetch('/api/awards/spenddown-alerts').then((r) => r.json()).catch(() => ({ alerts: [] })),
        fetch('/api/awards/calendar').then((r) => r.json()).catch(() => ({ events: [] })),
      ]);
      setAwards(awardsRes.awards ?? []);
      setAlerts(alertsRes.alerts ?? []);
      setCalendarEvents(calendarRes.events ?? []);
    } catch (_err) {
      setError('Failed to load post-award data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleAddExpense = async (awardId: string) => {
    if (!expenseForm.date || !expenseForm.amount) return;
    try {
      await fetch('/api/awards/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ awardId, ...expenseForm, amount: Number(expenseForm.amount) }),
      });
      setExpenseForm({ date: '', description: '', amount: '', category: '' });
      setShowAddExpense(null);
      showToast('Expense added');
      void loadData();
    } catch (_err) {
      setError('Failed to add expense');
    }
  };

  const handleAddPlanned = async (awardId: string) => {
    if (!plannedForm.date || !plannedForm.amount) return;
    try {
      await fetch('/api/awards/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ awardId, ...plannedForm, amount: Number(plannedForm.amount), isPlanned: true }),
      });
      setPlannedForm({ date: '', description: '', amount: '', category: '' });
      setShowAddPlanned(null);
      showToast('Planned expense added');
      void loadData();
    } catch (_err) {
      setError('Failed to add planned expense');
    }
  };

  const loadBudgetVsActual = async (awardId: string) => {
    try {
      const res = await fetch(`/api/awards/${awardId}/budget-vs-actual`);
      const data = await res.json();
      setBudgetVsActual((prev) => ({ ...prev, [awardId]: data.rows ?? [] }));
    } catch (_err) {
      setError('Failed to load budget vs actual');
    }
  };

  const totalAwarded = awards.reduce((sum, a) => sum + (typeof a.amount === 'number' ? a.amount : parseFloat(a.amount || '0')), 0);
  const totalSpent = Object.values(_budgetCategories)
    .flat()
    .reduce((sum, c) => sum + (c.spent || 0), 0);
  const _totalBudgeted = Object.values(_budgetCategories)
    .flat()
    .reduce((sum, c) => sum + (c.budgeted || 0), 0);

  const _getSpendColor = (spent: number, budgeted: number): string => {
    if (budgeted <= 0) return 'var(--text-muted)';
    const pct = spent / budgeted;
    if (pct > 0.95) return 'var(--danger)';
    if (pct > 0.75) return 'var(--warning)';
    return 'var(--success)';
  };

  if (loading) {
    return (
      <div className="spinner-overlay" role="status" aria-busy="true" aria-label="Loading post-award data">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="post-award-view" data-testid="post-award-view">
      <div className="header">
        <div>
          <h1 className="header-title">Post-Award <span className="accent">Management</span></h1>
          <div className="header-sub">Track spend-down, compliance, and reporting</div>
        </div>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="settings-toast">
          {toast}
        </div>
      )}

      <div className="tabs mb-4">
        <button type="button" className={`tab ${activeTab === 'awards' ? 'tab-active' : ''}`} onClick={() => setActiveTab('awards')}>Awards</button>
        <button type="button" className={`tab ${activeTab === 'calendar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('calendar')}>Compliance Calendar</button>
        <button type="button" className={`tab ${activeTab === 'budget' ? 'tab-active' : ''}`} onClick={() => setActiveTab('budget')}>Budget vs Actual</button>
      </div>

      {activeTab === 'calendar' && (
        <div className="panel" data-testid="compliance-calendar">
          <div className="panel-header"><div className="panel-title">Compliance Calendar</div></div>
          {calendarEvents.length === 0 && <div className="text-muted">No upcoming deadlines</div>}
          <div className="deadline-list">
            {calendarEvents.map((evt) => (
              <div key={`${evt.awardId}-${evt.title}`} className={`deadline-item deadline-item-${evt.color}`}>
                <div className="deadline-date"><div className="deadline-day">{new Date(evt.dueDate).getDate()}</div><div className="deadline-month">{new Date(evt.dueDate).toLocaleString('default', { month: 'short' })}</div></div>
                <div>
                  <div className="deadline-info-title">{evt.title}</div>
                  <div className="deadline-info-meta">{evt.awardTitle} · {evt.type} · {evt.status}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'budget' && (
        <div className="panel" data-testid="budget-vs-actual">
          <div className="panel-header"><div className="panel-title">Budget vs Actual</div></div>
          {awards.length === 0 && <div className="text-muted">No awards</div>}
          {awards.map((award) => (
            <div key={award.id} className="post-award-section">
              <div className="font-bold mb-2">{award.title || `Award ${award.grantId}`}</div>
              <button type="button" className="btn btn-sm mb-2" onClick={() => loadBudgetVsActual(award.id)}>Load Report</button>
              {(budgetVsActual[award.id] || []).map((row) => (
                <div key={row.category} className={`post-award-item post-award-item-${row.status}`}>
                  <div>{row.category}</div>
                  <div className="text-sm">Budgeted: ${row.budgeted.toLocaleString()} · Spent: ${row.spent.toLocaleString()} · Planned: ${row.planned.toLocaleString()}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'awards' && awards.length === 0 ? (
        <div className="empty-state" data-testid="post-award-empty">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No active awards</div>
          <div className="empty-state-desc">
            Awarded grants will appear here for spend-down tracking, budget management, and compliance monitoring.
          </div>
        </div>
      ) : (
        <>
          <div className="post-award-summary">
            <div className="kpi-card">
              <div className="kpi-label">Active Awards</div>
              <div className="kpi-value">{awards.filter((a) => a.status === 'active').length}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Awarded</div>
              <div className="kpi-value">${totalAwarded.toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Total Spent</div>
              <div className="kpi-value">${totalSpent.toLocaleString()}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Remaining</div>
              <div className="kpi-value">${(totalAwarded - totalSpent).toLocaleString()}</div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="post-award-alerts" role="alert">
              {alerts.map((alert, i) => (
                <div key={i} className={`post-award-alert post-award-alert-${alert.type}`}>
                  {alert.type === 'under' ? '⚠️' : '🔴'} {alert.type === 'under' ? 'Under-spending detected' : 'Over-spending detected'} in {alert.category}
                </div>
              ))}
            </div>
          )}

          <div className="post-award-list">
            {awards.map((award) => (
              <div key={award.id} className="setting-card" data-testid={`award-card-${award.id}`}>
                <div className="setting-card-header" onClick={() => setExpandedAward(expandedAward === award.id ? null : award.id)} style={{ cursor: 'pointer' }}>
                  <div className="setting-card-title">
                    {expandedAward === award.id ? '▼' : '▶'} Award — Grant {award.grantId}
                  </div>
                  <span className="pipeline-column-count">${(typeof award.amount === 'number' ? award.amount : parseFloat(award.amount || '0')).toLocaleString()}</span>
                </div>
                {expandedAward === award.id && (
                  <div className="setting-card-body">
                    <div>Period: {award.startDate} — {award.endDate}</div>
                    <div>Status: {award.status}</div>

                    <div className="post-award-section">
                      <strong>Budget Categories</strong>
                      <button type="button" className="btn btn-sm" onClick={() => setShowAddExpense(award.id)}>+ Add Expense</button>
                      <button type="button" className="btn btn-sm ml-2" onClick={() => setShowAddPlanned(award.id)}>+ Add Planned Expense</button>
                      {showAddExpense === award.id && (
                        <div className="post-award-expense-form">
                          <input className="form-input" type="date" value={expenseForm.date} onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))} />
                          <input className="form-input" type="text" placeholder="Description" value={expenseForm.description} onChange={(e) => setExpenseForm((prev) => ({ ...prev, description: e.target.value }))} />
                          <input className="form-input" type="number" placeholder="Amount" value={expenseForm.amount} onChange={(e) => setExpenseForm((prev) => ({ ...prev, amount: e.target.value }))} />
                          <input className="form-input" type="text" placeholder="Category" value={expenseForm.category} onChange={(e) => setExpenseForm((prev) => ({ ...prev, category: e.target.value }))} />
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddExpense(award.id)}>Save</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddExpense(null)}>Cancel</button>
                        </div>
                      )}
                      {showAddPlanned === award.id && (
                        <div className="post-award-expense-form">
                          <input className="form-input" type="date" value={plannedForm.date} onChange={(e) => setPlannedForm((prev) => ({ ...prev, date: e.target.value }))} />
                          <input className="form-input" type="text" placeholder="Description" value={plannedForm.description} onChange={(e) => setPlannedForm((prev) => ({ ...prev, description: e.target.value }))} />
                          <input className="form-input" type="number" placeholder="Amount" value={plannedForm.amount} onChange={(e) => setPlannedForm((prev) => ({ ...prev, amount: e.target.value }))} />
                          <input className="form-input" type="text" placeholder="Category" value={plannedForm.category} onChange={(e) => setPlannedForm((prev) => ({ ...prev, category: e.target.value }))} />
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddPlanned(award.id)}>Save Planned</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddPlanned(null)}>Cancel</button>
                        </div>
                      )}
                    </div>

                    <div className="post-award-section">
                      <strong>Upcoming Reports</strong>
                      {(_reportDeadlines[award.id] || []).length === 0 && <div className="text-muted">No reports scheduled</div>}
                      {(_reportDeadlines[award.id] || []).map((rpt: AwardReportDeadline) => (
                        <div key={rpt.id} className="post-award-item">
                          {rpt.reportType} — Due: {rpt.dueDate} — <span className={`status-${rpt.status}`}>{rpt.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="post-award-section">
                      <strong>Compliance</strong>
                      {(_complianceItems[award.id] || []).length === 0 && <div className="text-muted">No compliance items</div>}
                      {(_complianceItems[award.id] || []).map((item: AwardComplianceItem) => (
                        <div key={item.id} className="post-award-item">
                          {item.requirement} — <span className={`status-${item.status}`}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
