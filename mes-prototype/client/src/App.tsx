import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AuthProvider } from './context/AuthProvider';
import { ConfirmProvider } from './context/ConfirmProvider';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import DailyEntry from './pages/DailyEntry';
import StaffMaster from './pages/StaffMaster';
import Standards from './pages/Standards';
import Reports from './pages/Reports';
import ActivityMapping from './pages/ActivityMapping';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Login from './pages/Login';
import CommandPalette from './components/CommandPalette';
import MissingStandards from './pages/MissingStandards';
import SyncCenter from './pages/SyncCenter';
import DeletedEntries from './pages/DeletedEntries';
import ProductMaster from './pages/ProductMaster';
import ErrorBoundary from './components/ErrorBoundary';
import MesAppLayout from './layouts/MesAppLayout';
import { Skeleton } from '@/components/ui/skeleton';

function AuthLoading() {
  return (
    <div className="mesh-bg flex min-h-[100dvh] items-center justify-center p-8 text-foreground">
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-2 gap-4 pt-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AuthenticatedShell() {
  const { user, can } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitial, setPaletteInitial] = useState('');

  const landing = useMemo(() => {
    if (!user) return '/login';
    if (user.role === 'operator') return '/floor';
    if (user.role === 'admin') return '/dashboard';
    return can('reports:read') ? '/dashboard' : '/daily-entry';
  }, [user, can]);

  const navActions = useMemo(() => {
    const items = [
      { to: '/dashboard', label: 'Dashboard', group: 'Reports', permission: 'reports:read' },
      { to: '/floor', label: 'Floor entry', group: 'Production', permission: 'daily-grading:write' },
      { to: '/daily-entry', label: "Today's production", group: 'Production', permission: 'daily-grading:write' },
      { to: '/reports', label: 'Scorecards', group: 'Reports', permission: 'reports:read' },
      { to: '/staff', label: 'Staff And Department', group: 'Reports', permission: 'reports:read' },
      { to: '/sync', label: 'Sync Center', group: 'Reports', permission: 'daily-grading:write' },
      { to: '/deleted-entries', label: 'Deleted entries', group: 'Reports', permission: 'daily-grading:delete' },
      { to: '/product-master', label: 'Product master', group: 'Setup', permission: 'reports:read' },
      { to: '/standards', label: 'Grading rules', group: 'Setup', permission: 'standards:read' },
      { to: '/missing-standards', label: 'Missing standards', group: 'Setup', permission: 'standards:read' },
      { to: '/activity-mapping', label: 'Job ↔ work station', group: 'Setup', permission: 'activity-mapping:write' },
      { to: '/users', label: 'Users', group: 'Setup', permission: 'users:manage' },
    ];
    return items
      .filter((i) => !i.permission || can(i.permission))
      .filter((i) => {
        if (user?.role === 'operator') return i.to !== '/daily-entry';
        return i.to !== '/floor';
      })
      .map((i) => ({ id: i.to, label: i.label, hint: i.group, to: i.to }));
  }, [user, can]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteInitial('');
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onOpenPalette(e: Event) {
      const ev = e as CustomEvent<{ q?: string }>;
      setPaletteInitial(ev.detail?.q || '');
      setPaletteOpen(true);
    }
    window.addEventListener('mes:openPalette', onOpenPalette as EventListener);
    return () => window.removeEventListener('mes:openPalette', onOpenPalette as EventListener);
  }, []);

  if (!user) return null;

  const role = user.role;

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialQuery={paletteInitial}
        navActions={navActions}
      />
      <Routes>
        <Route element={<MesAppLayout />}>
          <Route path="/" element={<Navigate to={landing} replace />} />
          <Route path="/dashboard" element={<ProtectedRoute permission="reports:read"><Dashboard /></ProtectedRoute>} />
          <Route
            path="/floor"
            element={
              <ProtectedRoute permission="daily-grading:write">
                {role === 'operator' ? <DailyEntry floorMode /> : <Navigate to="/daily-entry" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-entry"
            element={
              <ProtectedRoute permission="daily-grading:write">
                {role === 'operator' ? <Navigate to="/floor" replace /> : <DailyEntry />}
              </ProtectedRoute>
            }
          />
          <Route path="/reports" element={<ProtectedRoute permission="reports:read"><Reports /></ProtectedRoute>} />
          <Route path="/sync" element={<ProtectedRoute permission="daily-grading:write"><SyncCenter /></ProtectedRoute>} />
          <Route path="/deleted-entries" element={<ProtectedRoute permission="daily-grading:delete"><DeletedEntries /></ProtectedRoute>} />
          <Route path="/standards" element={<ProtectedRoute permission="standards:read"><Standards /></ProtectedRoute>} />
          <Route path="/missing-standards" element={<ProtectedRoute permission="standards:read"><MissingStandards /></ProtectedRoute>} />
          <Route path="/activity-mapping" element={<ProtectedRoute permission="activity-mapping:write"><ActivityMapping /></ProtectedRoute>} />
          <Route path="/product-master" element={<ProtectedRoute permission="reports:read"><ProductMaster /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute permission="reports:read"><StaffMaster /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute permission="users:manage"><Users /></ProtectedRoute>} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary title="Application error" homeTo="/login" homeLabel="Back to sign in">
      <AuthProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <ErrorBoundary resetKey="login" title="Sign-in error" homeTo="/login" homeLabel="Try again">
                  <Login />
                </ErrorBoundary>
              }
            />
            <Route element={<RequireAuth />}>
              <Route path="/*" element={<AuthenticatedShell />} />
            </Route>
          </Routes>
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
