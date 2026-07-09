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

// Page -> route lookup, matches the accessKey strings stored in the Master sheet's Access column.
const ACCESS_ROUTES = [
  { accessKey: 'Daily Report', path: '/daily-report' },
  { accessKey: 'Dashboard', path: '/dashboard' },
  { accessKey: 'Admin Approval', path: '/admin-approval' },
];

const NoAccess = () => (
  <div className="flex flex-col items-center justify-center py-24 text-center gap-2">
    <p className="text-lg font-bold text-gray-700">No pages assigned to your account</p>
    <p className="text-sm text-gray-500">Contact your administrator to get page access.</p>
  </div>
);

// Land each user on the first page they actually have access to, instead of a fixed page.
// ADMIN / MASTER ADMIN always land on the Dashboard since they can see everything.
const HomeRedirect = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MASTER ADMIN';
  if (isAdmin) return <Navigate to="/dashboard" replace />;

  const userAccess = user?.access || [];
  const firstAccessible = ACCESS_ROUTES.find(r => userAccess.includes(r.accessKey));
  return firstAccessible ? <Navigate to={firstAccessible.path} replace /> : <NoAccess />;
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
            <Route path="dashboard" element={<ProtectedRoute accessKey="Dashboard"><AdminDashboard /></ProtectedRoute>} />
            <Route path="daily-report" element={<ProtectedRoute accessKey="Daily Report"><DailyReport /></ProtectedRoute>} />
            <Route path="admin-approval" element={<ProtectedRoute accessKey="Admin Approval"><AdminApproval /></ProtectedRoute>} />
            {/* Settings manages every user's credentials/roles — always admin-only, regardless of the Access column */}
            <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;