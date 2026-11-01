import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  required,
  id,
  className = '',
  containerClassName = '',
  onKeyDown,
  ...props
}, ref) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If user presses Enter without Ctrl/Cmd:
    // Move to next input field instead of accidental form submission
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
        <label htmlFor={inputId} className="form-label">
          {label}
          {required && <span className="required" aria-hidden="true">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`input-field ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="form-error" role="alert">
          {error}
        </span>
      )}
      {!error && helperText && (
        <span className="form-helper" style={{ fontSize: '11px', color: '#64748b' }}>
          {helperText}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
