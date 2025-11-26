// Sidebar Component
// ==================
// תפריט ניווט צדדי

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    {
      to: '/',
      icon: 'fas fa-home',
      label: 'דף הבית',
    },
    {
      to: '/clients',
      icon: 'fas fa-users',
      label: 'תיקים',
    },
    {
      to: '/procedures',
      icon: 'fas fa-gavel',
      label: 'הליכים',
    },
    {
      to: '/reports',
      icon: 'fas fa-chart-pie',
      label: 'דוחות',
    },
    {
      to: '/settings',
      icon: 'fas fa-cog',
      label: 'הגדרות',
    },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <i className="fas fa-balance-scale"></i>
          </div>
          <div className="brand-text">משרד ע"ד</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : ''}`
              }
              onClick={onClose}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </NavLink>
          ))}

          <div className="nav-divider"></div>

          <button className="nav-item nav-item-logout" onClick={handleLogout}>
            <i className="fas fa-power-off"></i>
            <span>יציאה</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">
            <i className="fas fa-user"></i>
          </div>
        </div>
      </aside>
    </>
  );
};
