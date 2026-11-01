import React, { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  required?: boolean;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  options,
  required,
  id,
  className = '',
  containerClassName = '',
  onKeyDown,
  ...props
}, ref) => {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSelectElement>) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && e.currentTarget.form) {
      const form = e.currentTarget.form;
      const elements = Array.from(
        form.querySelectorAll<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button[type="submit"]:not([disabled])'
        )
      );
      const currentIndex = elements.indexOf(e.currentTarget);
      if (currentIndex > -1 && currentIndex < elements.length - 1) {
        e.preventDefault();
        elements[currentIndex + 1].focus();
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className={`form-group ${containerClassName}`}>
      {label && (
        <label htmlFor={selectId} className="form-label">
          {label}
          {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={`select-field ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        required={required}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

Select.displayName = 'Select';
