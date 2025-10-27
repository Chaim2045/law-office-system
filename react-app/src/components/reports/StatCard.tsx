// Stat Card Component
// ====================
// כרטיס סטטיסטיקה

import React from 'react';
import { Card } from '@components/common';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  subtitle?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trend,
  color = 'primary',
  subtitle,
}) => {
  return (
    <Card className={`stat-card stat-card-${color}`}>
      <div className="stat-card-content">
        <div className="stat-card-header">
          <div className={`stat-icon stat-icon-${color}`}>{icon}</div>
          {trend && (
            <div className={`stat-trend stat-trend-${trend.direction}`}>
              <i className={`fas fa-arrow-${trend.direction}`}></i>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>

        <div className="stat-card-body">
          <h3 className="stat-value">{value}</h3>
          <p className="stat-title">{title}</p>
          {subtitle && <p className="stat-subtitle">{subtitle}</p>}
        </div>
      </div>
    </Card>
  );
};
