// Spinner Component
// ==================
// אנימציית טעינה

import React from 'react';
import './Spinner.css';

export type SpinnerSize = 'small' | 'medium' | 'large';
export type SpinnerColor = 'primary' | 'white' | 'dark';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  center?: boolean;
  fullScreen?: boolean;
  text?: string;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  center = false,
  fullScreen = false,
  text,
  className = '',
}) => {
  const spinnerClassNames = [
    'spinner',
    `spinner-${size}`,
    `spinner-${color}`,
    center && 'spinner-center',
    fullScreen && 'spinner-fullscreen',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <div className={spinnerClassNames}>
      <div className="spinner-circle"></div>
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="spinner-fullscreen-overlay">
        {content}
      </div>
    );
  }

  return content;
};
