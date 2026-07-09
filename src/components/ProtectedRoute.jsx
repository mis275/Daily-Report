import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children, adminOnly = false, accessKey = null }) => {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'MASTER ADMIN';

  // ADMIN / MASTER ADMIN bypass access-list checks and see every page.
  if (isAdmin) {
    return <>{children}</>;
  }

  if (adminOnly) {
    return <Navigate to="/" replace />;
  }

  if (accessKey) {
    const userAccess = user.access || [];
    if (!userAccess.includes(accessKey)) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;