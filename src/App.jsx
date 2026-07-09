import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import DailyReport from './pages/DailyReport';
import AdminApproval from './pages/AdminApproval';
import Settings from './pages/Settings';
import ProtectedRoute from './components/ProtectedRoute';
import { initializeStorage } from './utils/storageManager';

import { useAuthStore } from './store/authStore';

// Employees only ever see their own data (enforced in DailyReport itself);
// Dashboard/Admin Approval/Settings expose every employee's records and credentials,
// so only ADMIN / MASTER ADMIN may land there.
const HomeRedirect = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER ADMIN';
  return isAdmin ? <AdminDashboard /> : <Navigate to="/daily-report" replace />;
};

function App() {
  const initializeAuth = useAuthStore(state => state.initializeAuth);

  useEffect(() => {
    initializeAuth();
    initializeStorage();
  }, [initializeAuth]);

  return (
    <div className="gradient-bg min-h-screen">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<HomeRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
            <Route path="daily-report" element={<DailyReport />} />
            <Route path="admin-approval" element={<ProtectedRoute adminOnly><AdminApproval /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;