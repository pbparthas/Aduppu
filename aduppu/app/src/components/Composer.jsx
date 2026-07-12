/* Composer — labelled-field stack with explicit Save/Cancel for editing and adding items.
   One editing model everywhere: no save-on-blur, no fake buttons. */

import SegRow from './SegRow.jsx';

export default function Composer({
  fields,
  values,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saveLabel = 'Save',
}) {
  function handleFieldChange(key, val) {
    onChange({ ...values, [key]: val });
  }

  function renderField(field) {
    const val = values[field.key] ?? '';

    switch (field.type) {
      case 'select':
        return (
          <select
            className="form-input"
            value={val}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          >
            <option value="">{field.placeholder || 'Select...'}</option>
            {(field.options || []).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'seg':
        return (
          <SegRow
            items={(field.options || []).map((o) => ({ key: o.value, label: o.label }))}
            value={val}
            onChange={(key) => handleFieldChange(field.key, key)}
          />
        );

      case 'textarea':
        return (
          <textarea
            className="form-input"
            value={val}
            placeholder={field.placeholder || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            rows={3}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className="form-input"
            value={val}
            placeholder={field.placeholder || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            className="form-input"
            value={val}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );

      default: /* text */
        return (
          <input
            type="text"
            className="form-input"
            value={val}
            placeholder={field.placeholder || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        );
    }
  }

  return (
    <div className="form-stack">
      {fields.map((field) => (
        <label key={field.key} className="form-label">
          <span className="form-label-text">{field.label}</span>
          {renderField(field)}
        </label>
      ))}

      <div className="btn-row">
        <button type="button" className="btn accent" onClick={onSave}>
          {saveLabel}
        </button>
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        {onDelete && (
          <button
            type="button"
            className="btn ghost composer-delete"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
