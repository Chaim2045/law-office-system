// Progress Bar Component
// =======================
// פס התקדמות

import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  showLabel = true,
  size = 'medium',
  color = 'primary',
}) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={`progress-bar-container progress-bar-${size}`}>
      {showLabel && (
        <div className="progress-bar-label">
          <span>
            {current} מתוך {total}
          </span>
          <span className="progress-bar-percentage">{percentage}%</span>
        </div>
      )}
      <div className="progress-bar-track">
        <div
          className={`progress-bar-fill progress-bar-${color}`}
          style={{ width: `${percentage}%` }}
        >
          {!showLabel && <span className="progress-bar-inner-text">{percentage}%</span>}
        </div>
      </div>
    </div>
  );
};
