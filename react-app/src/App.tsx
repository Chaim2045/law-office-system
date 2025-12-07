// Main App Component
// ===================
// הקומפוננטה הראשית של האפליקציה

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, AuthContext } from '@context/AuthContext';
import { NotificationProvider } from '@context/NotificationContext';
import { BudgetTasksProvider } from '@context/BudgetTasksContext';
import { TimesheetProvider } from '@context/TimesheetContext';
import { ClientsProvider } from '@context/ClientsContext';
import { LegalProceduresProvider } from '@context/LegalProceduresContext';
import { ReportsProvider } from '@context/ReportsContext';
import { AIProvider } from '@context/AIContext';
import { AdminProvider } from '@contexts/AdminContext';
import { MainLayout } from '@components/layout';
import { Spinner } from '@components/common';
import { ChatBot } from '@components/ai';
import { Login } from '@pages/Login';
import { Dashboard } from '@pages/Dashboard';
import { BudgetTasks } from '@pages/BudgetTasks';
import { Timesheet } from '@pages/Timesheet';
import { Cases } from '@pages/Cases';
import { LegalProcedures } from '@pages/LegalProcedures';
import { Reports } from '@pages/Reports';
import { Settings } from '@pages/Settings';

// Admin imports
import { AdminLayout } from '@components/admin/AdminLayout';
import { AdminDashboard } from '@pages/admin/AdminDashboard';
import { AdminUsers } from '@pages/admin/AdminUsers';

import 'react-toastify/dist/ReactToastify.css';

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = React.useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { user, loading } = authContext;

  if (loading) {
    return <Spinner fullScreen text="טוען..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirect if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authContext = React.useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { user, loading } = authContext;

  if (loading) {
    return <Spinner fullScreen text="טוען..." />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AdminProvider>
          <NotificationProvider>
            <ClientsProvider>
              <LegalProceduresProvider>
                <BudgetTasksProvider>
                  <TimesheetProvider>
                    <ReportsProvider>
                      <AIProvider>
                      {/* Toast Notifications */}
            <ToastContainer
              position="top-left"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={true}
              closeOnClick
              rtl={true}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="light"
            />

            {/* Routes */}
            <Routes>
            {/* Public Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/clients"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Cases />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/budget"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <BudgetTasks />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/timesheet"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Timesheet />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Reports />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/procedures"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <LegalProcedures />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Settings />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            {/* Fallback - Redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* AI ChatBot - Available globally for authenticated users */}
          <ChatBot />
                    </AIProvider>
                  </ReportsProvider>
                </TimesheetProvider>
              </BudgetTasksProvider>
            </LegalProceduresProvider>
          </ClientsProvider>
        </NotificationProvider>
        </AdminProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
