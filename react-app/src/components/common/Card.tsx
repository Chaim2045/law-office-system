// Card Component
// ===============
// כרטיס תוכן רב-שימושי

import React, { HTMLAttributes, ReactNode } from 'react';
import './Card.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  headerAction,
  footer,
  children,
  noPadding = false,
  hoverable = false,
  className = '',
  ...props
}) => {
  const cardClassNames = ['card', hoverable && 'card-hoverable', className]
    .filter(Boolean)
    .join(' ');

  const bodyClassNames = ['card-body', noPadding && 'card-body-no-padding']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClassNames} {...props}>
      {(title || subtitle || headerAction) && (
        <div className="card-header">
          <div className="card-header-content">
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div className="card-header-action">{headerAction}</div>}
        </div>
      )}

      <div className={bodyClassNames}>{children}</div>

      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};
