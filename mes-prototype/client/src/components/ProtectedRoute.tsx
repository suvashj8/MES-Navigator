import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({
  children,
  permission,
}: {
  children: React.ReactNode;
  permission?: string;
}) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <Spinner className="h-5 w-5 text-amber-300" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">You do not have permission to access this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
