// Input Component
// ================
// שדה קלט רב-שימושי

import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, fullWidth = false, className = '', ...props }, ref) => {
    const inputClassNames = [
      'input-field',
      error && 'input-error',
      icon && 'input-with-icon',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const wrapperClassNames = ['input-wrapper', fullWidth && 'input-full-width']
      .filter(Boolean)
      .join(' ');

    return (
      <div className={wrapperClassNames}>
        {label && (
          <label className="input-label">
            {label}
            {props.required && <span className="input-required">*</span>}
          </label>
        )}

        <div className="input-container">
          {icon && <span className="input-icon">{icon}</span>}
          <input ref={ref} className={inputClassNames} {...props} />
        </div>

        {error && <span className="input-error-text">{error}</span>}
        {helperText && !error && <span className="input-helper-text">{helperText}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
