import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  ClipboardList,
  Factory,
  LayoutDashboard,
  Link2,
  LogOut,
  Package,
  PenLine,
  RefreshCw,
  Trash2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';

type NavGroup = 'Production' | 'Reports' | 'Setup';

type NavItem = {
  to: string;
  label: string;
  group: NavGroup;
  permission?: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', group: 'Reports', permission: 'reports:read', icon: LayoutDashboard },
  { to: '/floor', label: 'Floor entry', group: 'Production', permission: 'daily-grading:write', icon: Factory },
  { to: '/daily-entry', label: "Today's production", group: 'Production', permission: 'daily-grading:write', icon: PenLine },
  { to: '/reports', label: 'Scorecards', group: 'Reports', permission: 'reports:read', icon: BarChart3 },
  { to: '/staff', label: 'Staff', group: 'Reports', permission: 'reports:read', icon: Users },
  { to: '/sync', label: 'Sync Center', group: 'Reports', permission: 'daily-grading:write', icon: RefreshCw },
  { to: '/deleted-entries', label: 'Deleted entries', group: 'Reports', permission: 'daily-grading:delete', icon: Trash2 },
  { to: '/product-master', label: 'Product master', group: 'Setup', permission: 'reports:read', icon: Package },
  { to: '/standards', label: 'Grading rules', group: 'Setup', permission: 'standards:read', icon: ClipboardList },
  { to: '/missing-standards', label: 'Missing standards', group: 'Setup', permission: 'standards:read', icon: AlertTriangle },
  { to: '/activity-mapping', label: 'Job ↔ work station', group: 'Setup', permission: 'activity-mapping:write', icon: Link2 },
  { to: '/users', label: 'Users', group: 'Setup', permission: 'users:manage', icon: UserCog },
];

function NavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/80">{title}</p>
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                : 'text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}

export function MesAppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNavigate();
  const { user, logout, can } = useAuth();

  const visibleNav = navItems
    .filter((item) => !item.permission || can(item.permission))
    .filter((item) => {
      if (user?.role === 'operator') return item.to !== '/daily-entry';
      return item.to !== '/floor';
    });

  const groups = (['Reports', 'Production', 'Setup'] as const)
    .map((group) => ({ group, items: visibleNav.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30">
          <Factory className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight">MES</p>
          <p className="truncate text-[11px] text-sidebar-foreground/85">Navigator Bead for Life</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groups.map(({ group, items }) => (
          <NavSection key={group} title={group} items={items} onNavigate={onNavigate} />
        ))}
      </nav>
      <Separator className="bg-sidebar-border" />
      <div className="space-y-3 p-4">
        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'block rounded-lg px-3 py-2.5 transition-colors',
              isActive ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent'
            )
          }
        >
          <p className="truncate text-xs font-medium">{user?.display_name}</p>
          <p className="text-[11px] capitalize text-sidebar-foreground/85">{user?.role}</p>
          {user?.department && <p className="text-[11px] text-primary/80">{user.department}</p>}
        </NavLink>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={() => {
            logout();
            onNavigate?.();
            nav('/login');
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
