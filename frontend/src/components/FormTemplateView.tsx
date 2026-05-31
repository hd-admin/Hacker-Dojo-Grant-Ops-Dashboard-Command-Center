'use client';

import React, { useState } from 'react';

interface FormField {
  id: string;
  label: string;
  type: string;
  suggestedAnswer?: string;
}

interface FormTemplate {
  id: string;
  funderName: string;
  fields: FormField[];
}

interface FormTemplateViewProps {
  template: FormTemplate;
  onSave?: (answers: Record<string, string>) => void;
}

export function FormTemplateView({ template, onSave }: FormTemplateViewProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = (fieldId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  return (
    <div className="form-template-view" data-testid="form-template-view">
      <h3 className="font-heading">{template.funderName}</h3>
      <div className="form-fields">
        {template.fields.map((field) => (
          <div key={field.id} className="form-field">
            <label className="form-label">{field.label}</label>
            {field.suggestedAnswer && (
              <div className="suggested-answer">Suggested: {field.suggestedAnswer}</div>
            )}
            <textarea
              className="form-input"
              value={answers[field.id] ?? ''}
              onChange={(e) => handleChange(field.id, e.target.value)}
              aria-label={field.label}
            />
          </div>
        ))}
      </div>
      {onSave && (
        <button type="button" className="btn btn-primary" onClick={() => onSave(answers)}>
          Save Answers
        </button>
      )}
    </div>
  );
}

