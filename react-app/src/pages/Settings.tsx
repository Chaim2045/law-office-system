// Settings Page
// ==============
// עמוד הגדרות משתמש ומערכת

import React, { useState } from 'react';
import { useAuth } from '@hooks/useAuth';
import { Card } from '@components/common';
import './Settings.css';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'about'>('profile');

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>
          <i className="fas fa-cog"></i>
          הגדרות
        </h1>
        <p>ניהול הגדרות אישיות ומערכת</p>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        <button
          className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <i className="fas fa-user"></i>
          פרופיל
        </button>
        <button
          className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          <i className="fas fa-sliders-h"></i>
          העדפות
        </button>
        <button
          className={`settings-tab ${activeTab === 'about' ? 'active' : ''}`}
          onClick={() => setActiveTab('about')}
        >
          <i className="fas fa-info-circle"></i>
          אודות
        </button>
      </div>

      {/* Content */}
      <div className="settings-content">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="settings-tab-content">
            <Card>
              <h2 className="section-title">פרטים אישיים</h2>

              <div className="profile-info">
                <div className="profile-avatar">
                  <div className="avatar-circle">
                    <i className="fas fa-user"></i>
                  </div>
                </div>

                <div className="profile-details">
                  <div className="profile-field">
                    <label>שם מלא</label>
                    <div className="field-value">{user?.displayName || 'לא צוין'}</div>
                  </div>

                  <div className="profile-field">
                    <label>אימייל</label>
                    <div className="field-value">{user?.email || 'לא צוין'}</div>
                  </div>

                  <div className="profile-field">
                    <label>שם משתמש</label>
                    <div className="field-value">{user?.username || 'לא צוין'}</div>
                  </div>

                  <div className="profile-field">
                    <label>תפקיד</label>
                    <div className="field-value">
                      {user?.role === 'admin'
                        ? 'מנהל'
                        : user?.role === 'lawyer'
                        ? 'עורך דין'
                        : 'עוזר'}
                    </div>
                  </div>

                  <div className="profile-field">
                    <label>סטטוס</label>
                    <div className="field-value">
                      {user?.isActive ? (
                        <span className="badge badge-success">פעיל</span>
                      ) : (
                        <span className="badge badge-danger">לא פעיל</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-actions">
                <button className="btn btn-secondary" disabled>
                  <i className="fas fa-edit"></i>
                  ערוך פרופיל
                </button>
                <button className="btn btn-secondary" disabled>
                  <i className="fas fa-key"></i>
                  שנה סיסמה
                </button>
              </div>

              <p className="settings-note">
                💡 לעריכת פרטים אישיים, פנה למנהל המערכת
              </p>
            </Card>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="settings-tab-content">
            <Card>
              <h2 className="section-title">העדפות תצוגה</h2>

              <div className="preferences-grid">
                <div className="preference-item">
                  <div className="preference-info">
                    <h3>
                      <i className="fas fa-bell"></i>
                      התראות
                    </h3>
                    <p>קבל התראות על אירועים חשובים</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked disabled />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <h3>
                      <i className="fas fa-envelope"></i>
                      אימייל
                    </h3>
                    <p>קבל עדכונים במייל</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked disabled />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <h3>
                      <i className="fas fa-robot"></i>
                      עוזר חכם
                    </h3>
                    <p>הפעל/כבה את העוזר החכם מבוסס AI</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" defaultChecked disabled />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="preference-item">
                  <div className="preference-info">
                    <h3>
                      <i className="fas fa-moon"></i>
                      מצב כהה
                    </h3>
                    <p>החלף למצב כהה (בקרוב)</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" disabled />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <p className="settings-note">⚠️ העדפות אלו נשמרות מקומית במחשב שלך</p>
            </Card>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="settings-tab-content">
            <Card>
              <h2 className="section-title">אודות המערכת</h2>

              <div className="about-section">
                <div className="about-logo">
                  <i className="fas fa-balance-scale"></i>
                </div>

                <h3>מערכת ניהול משרד עורכי דין</h3>
                <p className="about-description">
                  מערכת מתקדמת לניהול תיקים, משימות, שעות עבודה והליכים משפטיים
                </p>

                <div className="about-info-grid">
                  <div className="about-info-item">
                    <strong>גרסה</strong>
                    <span>2.0.0 (React)</span>
                  </div>
                  <div className="about-info-item">
                    <strong>טכנולוגיה</strong>
                    <span>React 18 + TypeScript</span>
                  </div>
                  <div className="about-info-item">
                    <strong>Backend</strong>
                    <span>Firebase Cloud Functions</span>
                  </div>
                  <div className="about-info-item">
                    <strong>Database</strong>
                    <span>Firestore</span>
                  </div>
                </div>

                <div className="about-features">
                  <h4>תכונות עיקריות</h4>
                  <div className="features-grid">
                    <div className="feature-item">
                      <i className="fas fa-folder-open"></i>
                      <span>ניהול תיקים ולקוחות</span>
                    </div>
                    <div className="feature-item">
                      <i className="fas fa-tasks"></i>
                      <span>משימות תקציב</span>
                    </div>
                    <div className="feature-item">
                      <i className="fas fa-clock"></i>
                      <span>שעון נוכחות</span>
                    </div>
                    <div className="feature-item">
                      <i className="fas fa-gavel"></i>
                      <span>הליכים משפטיים</span>
                    </div>
                    <div className="feature-item">
                      <i className="fas fa-chart-bar"></i>
                      <span>דוחות וסטטיסטיקות</span>
                    </div>
                    <div className="feature-item">
                      <i className="fas fa-robot"></i>
                      <span>עוזר חכם AI</span>
                    </div>
                  </div>
                </div>

                <div className="about-footer">
                  <p>
                    <i className="fas fa-code"></i>
                    פותח על ידי Claude Code בשיתוף עם OpenAI
                  </p>
                  <p className="copyright">© 2025 כל הזכויות שמורות</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};
