import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { memo, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import DailyEntry from './pages/DailyEntry';
import StaffMaster from './pages/StaffMaster';
import Standards from './pages/Standards';
import Reports from './pages/Reports';
import ActivityMapping from './pages/ActivityMapping';
import Users from './pages/Users';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Spinner from './components/Spinner';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import CommandPalette from './components/CommandPalette';
import MissingStandards from './pages/MissingStandards';
import SyncCenter from './pages/SyncCenter';
import DeletedEntries from './pages/DeletedEntries';
import ProductMaster from './pages/ProductMaster';

type NavGroup = 'Production' | 'Reports' | 'Setup';
type NavItem = { to: string; label: string; group: NavGroup; permission?: string; icon: React.ReactNode };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="h-4 w-4 inline-flex items-center justify-center text-slate-400 group-hover:text-slate-200"
      aria-hidden
    >
      {children}
    </span>
  );
}

const icons = {
  dashboard: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 13h7V4H4v9zM13 20h7v-7h-7v7zM13 11h7V4h-7v7zM4 20h7v-5H4v5z" />
      </svg>
    </Icon>
  ),
  floor: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 20h16" />
        <path d="M6 20V8l6-4 6 4v12" />
        <path d="M9 20v-6h6v6" />
      </svg>
    </Icon>
  ),
  entry: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
      </svg>
    </Icon>
  ),
  reports: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M7 16v-5" />
        <path d="M12 16V8" />
        <path d="M17 16v-3" />
      </svg>
    </Icon>
  ),
  staff: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21a8 8 0 0 0-16 0" />
        <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
      </svg>
    </Icon>
  ),
  standards: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <path d="M8 6v12" />
      </svg>
    </Icon>
  ),
  mapping: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
        <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
      </svg>
    </Icon>
  ),
  users: (
    <Icon>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <path d="M9 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4z" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    </Icon>
  ),
} as const;

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', group: 'Reports', permission: 'reports:read', icon: icons.dashboard },

  { to: '/floor', label: 'Floor entry', group: 'Production', permission: 'daily-grading:write', icon: icons.floor },
  { to: '/daily-entry', label: "Today's production", group: 'Production', permission: 'daily-grading:write', icon: icons.entry },

  { to: '/reports', label: 'Scorecards', group: 'Reports', permission: 'reports:read', icon: icons.reports },
  { to: '/staff', label: 'Staff', group: 'Reports', permission: 'reports:read', icon: icons.staff },

  { to: '/sync', label: 'Sync Center', group: 'Reports', permission: 'daily-grading:write', icon: icons.reports },
  { to: '/deleted-entries', label: 'Deleted entries', group: 'Reports', permission: 'daily-grading:delete', icon: icons.reports },
  { to: '/product-master', label: 'Product master', group: 'Setup', permission: 'reports:read', icon: icons.standards },
  { to: '/standards', label: 'Grading rules', group: 'Setup', permission: 'standards:read', icon: icons.standards },
  { to: '/missing-standards', label: 'Missing standards', group: 'Setup', permission: 'standards:read', icon: icons.standards },
  { to: '/activity-mapping', label: 'Job ↔ work station', group: 'Setup', permission: 'activity-mapping:write', icon: icons.mapping },
  { to: '/users', label: 'Users', group: 'Setup', permission: 'users:manage', icon: icons.users },
];

const MainRoutes = memo(function MainRoutes({
  landing,
  role,
}: {
  landing: string;
  role: 'operator' | 'supervisor' | 'admin';
}) {
  const { user } = useAuth();
  return (
    <main className="flex-1 overflow-auto pb-20 md:pb-0">
      <div className="md:hidden sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 py-3 flex justify-between items-center print:hidden">
        <div>
          <p className="text-xs text-amber-400 font-semibold">Navigator Bead for Life MES</p>
          <p className="text-sm font-medium">{user?.display_name}</p>
        </div>
        <span className="text-[10px] capitalize text-slate-500 bg-slate-800 px-2 py-1 rounded">{role}</span>
      </div>
      <Routes>
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
      </Routes>
      <MobileNav />
    </main>
  );
});

function AppLayout() {
  const { user, loading, logout, can } = useAuth();
  const { theme, toggle } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitial, setPaletteInitial] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('mes_sidebar_collapsed');
    setSidebarCollapsed(stored === '1');
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem('mes_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="p-8 max-w-6xl mx-auto">
          <div className="flex items-center gap-3 text-slate-300">
            <Spinner className="h-5 w-5 text-amber-300" />
            <span className="text-sm">Loading your workspace…</span>
          </div>
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-900 border border-slate-800" />
            ))}
          </div>
          <div className="mt-6 h-40 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  const visibleNav = navItems
    .filter((item) => !item.permission || can(item.permission))
    .filter((item) => {
      if (user.role === 'operator') return item.to !== '/daily-entry';
      return item.to !== '/floor';
    });

  const groupedNav = (['Reports', 'Production', 'Setup'] as const)
    .map((g) => ({ group: g, items: visibleNav.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  const navActions = visibleNav.map((i) => ({
    id: i.to,
    label: i.label,
    hint: i.group,
    to: i.to,
  }));

  const landing =
    user.role === 'operator'
      ? '/floor'
      : user.role === 'admin'
        ? '/dashboard'
        : (can('reports:read') ? '/dashboard' : '/daily-entry');

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        initialQuery={paletteInitial}
        navActions={navActions}
      />
      <aside
        className={`hidden md:flex shrink-0 border-r border-slate-800 bg-slate-900/80 flex-col gap-6 print:hidden ${
          sidebarCollapsed ? 'w-[4.25rem] px-3 py-5' : 'w-64 p-5'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold">MES</p>
            {!sidebarCollapsed && (
              <>
                <h1 className="text-lg font-bold mt-1 leading-tight">Navigator Bead for Life MES</h1>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>Worker Performance &amp; Grading</span>
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800"
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    <span aria-hidden>{sidebarCollapsed ? '→' : '←'}</span>
                  </button>
                </p>
              </>
            )}
          </div>
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-800"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <span aria-hidden>→</span>
            </button>
          )}
        </div>
        <nav className="flex flex-col gap-4">
          {groupedNav.map(({ group, items }) => (
            <div key={group}>
              {!sidebarCollapsed && (
                <p className="px-2 mb-1 text-[10px] uppercase tracking-widest text-slate-500">{group}</p>
              )}
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `group px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`
                    }
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 pt-4 space-y-2">
          <NavLink to="/profile" className={({ isActive }) =>
            `block text-xs rounded-lg px-2 py-1.5 ${isActive ? 'text-amber-300 bg-slate-800' : 'text-slate-400 hover:text-white'}`
          }>
            {sidebarCollapsed ? (
              <span className="block text-[10px] text-slate-400 truncate">{user?.display_name}</span>
            ) : (
              <>
                {user?.display_name}
                <span className="block text-slate-500 capitalize">{user?.role}</span>
                {user?.department && (
                  <span className="block text-sky-400/80">{user.department}</span>
                )}
              </>
            )}
          </NavLink>
          <button
            type="button"
            onClick={toggle}
            className="w-full text-left text-xs rounded-lg px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button type="button" onClick={logout} className="text-xs text-slate-400 hover:text-red-400">
            Sign out
          </button>
        </div>
      </aside>

      <MainRoutes landing={landing} role={user.role} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
