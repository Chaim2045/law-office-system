// Header Component
// =================
// כותרת ראשית של האפליקציה

import React from 'react';
import { useAuth } from '@hooks/useAuth';
import { Button } from '@components/common';
import { NavLink } from 'react-router-dom';
import './Header.css';

interface HeaderProps {
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const { user } = useAuth();

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          {onToggleSidebar && (
            <Button
              variant="secondary"
              size="small"
              onClick={onToggleSidebar}
              icon={<i className="fas fa-bars"></i>}
            >
              תפריט
            </Button>
          )}
          <div className="header-title">
            <h1>מערכת ניהול מתקדמת</h1>
            <p>משרד עו"ד גיא הרשקוביץ</p>
          </div>
        </div>

        {/* טאבים מרכזיים עם פינות מעוגלות */}
        <div className="header-tabs">
          <NavLink
            to="/budget"
            className={({ isActive }) =>
              `header-tab ${isActive ? 'header-tab-active' : ''}`
            }
          >
            <i className="fas fa-tasks"></i>
            <span>תקצוב</span>
          </NavLink>
          <NavLink
            to="/timesheet"
            className={({ isActive }) =>
              `header-tab ${isActive ? 'header-tab-active' : ''}`
            }
          >
            <i className="fas fa-clock"></i>
            <span>שעתון</span>
          </NavLink>
        </div>

        <div className="header-right">
          {user && (
            <div className="user-info">
              <i className="fas fa-user-circle"></i>
              <span>{user.displayName}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
