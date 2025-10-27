// Header Component
// =================
// כותרת ראשית של האפליקציה

import React from 'react';
import { useAuth } from '@hooks/useAuth';
import { Button } from '@components/common';
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
