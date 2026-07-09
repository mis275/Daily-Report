import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'MASTER ADMIN';
  if (adminOnly && !isAdmin) {
    return <Navigate to="/daily-report" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;