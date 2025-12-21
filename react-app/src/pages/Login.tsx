// Login Page
// ===========
// עמוד התחברות למערכת

import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { Button, Input } from '@components/common';
import './Login.css';

export const Login: React.FC = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [formError, setFormError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user types
    if (formError) setFormError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!formData.email || !formData.password) {
      setFormError('אנא מלא את כל השדות');
      return;
    }

    try {
      await login(formData.email, formData.password);
      // Navigate to dashboard on success
      navigate('/');
    } catch (err) {
      // Error is already handled in AuthContext (toast notification)
      // We just set form error for visual feedback
      if (err && typeof err === 'object' && 'message' in err) {
        setFormError((err as Error).message);
      } else {
        setFormError('שגיאה בהתחברות');
      }
    }
  };

  return (
    <div className="login-page">
      {/* Login Container */}
      <div className="login-wrapper">
        {/* Logo */}
        <div className="login-logo">
          <img src="/images/logo.png" alt="משרד עו&quot;ד גיא הרשקוביץ" className="logo-image" />
          <h1>משרד עו"ד גיא הרשקוביץ</h1>
          <p>מערכת ניהול מתקדמת</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <h3>כניסה למערכת</h3>

          <form onSubmit={handleSubmit}>
            <Input
              type="email"
              name="email"
              label="אימייל"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
              fullWidth
              disabled={loading}
            />

            <Input
              type="password"
              name="password"
              label="סיסמה"
              placeholder="הזן סיסמה"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
              fullWidth
              disabled={loading}
            />

            {formError && <div className="login-error-message">{formError}</div>}

            <Button
              type="submit"
              variant="primary"
              size="large"
              fullWidth
              loading={loading}
              icon={!loading && <i className="fas fa-sign-in-alt"></i>}
            >
              כניסה
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p>© 2025 כל הזכויות שמורות למשרד עורכי דין גיא הרשקוביץ וחיים פרץ</p>
        </div>
      </div>
    </div>
  );
};
