'use client';

import React, { useCallback, useEffect, useState } from 'react';
import styles from './FormTemplateView.module.css';

interface FormField {
  id: string;
  label: string;
  type: string;
  suggestedAnswer?: string;
  required?: boolean;
}

interface FormTemplate {
  id: string;
  name: string;
  funderName?: string;
  funderId?: string | null;
  fields: FormField[];
  createdAt?: string;
}

interface FormTemplateViewProps {
  template?: FormTemplate;
  funderId?: string;
  onSave?: (answers: Record<string, string>) => void;
  onInsertDraft?: (template: FormTemplate, answers: Record<string, string>) => void;
}

export function FormTemplateView({ template, funderId, onSave, onInsertDraft }: FormTemplateViewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(template || null);
  const [loading, setLoading] = useState(!template);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/forms');
      if (res.ok) {
        const data = (await res.json()) as { forms: FormTemplate[] };
        const forms = data.forms || [];
        setTemplates(forms);
        if (!selectedTemplate && !template && forms.length > 0) {
          setSelectedTemplate(forms[0] as FormTemplate);
        }
      }
    } catch (_err) {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, template]);

  useEffect(() => {
    if (!template) {
      void loadTemplates();
    } else {
      setSelectedTemplate(template);
      setLoading(false);
    }
  }, [template, loadTemplates]);

  useEffect(() => {
    if (selectedTemplate) {
      const defaults: Record<string, string> = {};
      selectedTemplate.fields.forEach((field) => {
        if (field.suggestedAnswer) {
          defaults[field.id] = field.suggestedAnswer;
        }
      });
      setAnswers(defaults);
    }
  }, [selectedTemplate]);

  const handleSaveAnswers = () => {
    if (onSave) onSave(answers);
  };

  const handleInsertDraft = () => {
    if (onInsertDraft && selectedTemplate) {
      onInsertDraft(selectedTemplate, answers);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          funderId: funderId || selectedTemplate?.funderId || null,
          fields: [],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { form: FormTemplate };
        setTemplates((prev) => [...prev, data.form]);
        setSelectedTemplate(data.form);
        setNewName('');
        setShowCreateForm(false);
      }
    } catch (_err) {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/forms?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(null);
        }
      }
    } catch (_err) {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="form-template-view" data-testid="form-template-view">
        <div role="status" aria-busy="true" aria-label="Loading form templates">Loading templates...</div>
      </div>
    );
  }

  if (!selectedTemplate && templates.length === 0) {
    return (
      <div className="form-template-view" data-testid="form-template-view">
        <div className="empty-state">No form templates available.</div>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => setShowCreateForm(true)}
          aria-label="Create form template"
          data-testid="create-template-btn"
        >
          + Create template
        </button>
        {showCreateForm && (
          <form onSubmit={handleCreateTemplate} data-testid="template-create-form" className={styles.createFormRow}>
            <input
              type="text"
              placeholder="Template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Template name"
              className="form-input"
              required
            />
            <button type="submit" className="btn btn-sm btn-primary" disabled={saving || !newName.trim()}>
              {saving ? 'Creating...' : 'Create'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="form-template-view" data-testid="form-template-view">
      {templates.length > 1 && (
        <div className={styles.sectionSpacer}>
          <select
            value={selectedTemplate?.id || ''}
            onChange={(e) => {
              const t = templates.find((tmpl) => tmpl.id === e.target.value);
              if (t) setSelectedTemplate(t);
            }}
            className="form-input"
            aria-label="Select template"
            data-testid="template-select"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedTemplate && (
        <>
          <h3>{selectedTemplate.name}</h3>
          <div className="form-fields">
            {selectedTemplate.fields.map((field) => (
              <div key={field.id} className={`form-field ${styles.fieldBlock}`}>
                <label className="form-label" htmlFor={`field-${field.id}`}>
                  {field.label}{field.required ? ' *' : ''}
                </label>
                {field.suggestedAnswer && (
                  <div className={`suggested-answer ${styles.suggestedAnswer}`}>
                    Suggested: {field.suggestedAnswer}
                  </div>
                )}
                <textarea
                  id={`field-${field.id}`}
                  className="form-input"
                  value={answers[field.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  aria-label={field.label}
                  rows={3}
                />
              </div>
            ))}
          </div>

          <div className={styles.formActions}>
            {onSave && (
              <button type="button" className="btn btn-primary" onClick={handleSaveAnswers}>
                Save Answers
              </button>
            )}
            {onInsertDraft && (
              <button type="button" className="btn btn-primary" onClick={handleInsertDraft}>
                Insert into Draft
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowCreateForm((v) => !v)}
              aria-label="Create new template"
              data-testid="create-template-btn"
            >
              + New template
            </button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => { if (window.confirm(`Delete template "${selectedTemplate.name}"?`)) { void handleDeleteTemplate(selectedTemplate.id); } }}
              aria-label={`Delete template ${selectedTemplate.name}`}
              data-testid={`delete-template-${selectedTemplate.id}`}
            >
              Delete template
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateTemplate} data-testid="template-create-form" className={styles.createFormRow}>
              <input
                type="text"
                placeholder="Template name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="Template name"
                className="form-input"
                required
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={saving || !newName.trim()}>
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
