import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const items = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/dashboard', label: 'Dashboard', icon: '▦', permission: 'reports:read' },
  { to: '/floor', label: 'Entry', icon: '✎', permission: 'daily-grading:write' },
  { to: '/daily-entry', label: 'Daily', icon: '≡', permission: 'daily-grading:write' },
  { to: '/reports', label: 'Reports', icon: '▣', permission: 'reports:read' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

export default function MobileNav() {
  const { can, user } = useAuth();
  const { theme, toggle } = useTheme();
  const visible = items
    .filter((i) => !i.permission || can(i.permission))
    .filter((i) => {
      if (!user) return false;
      if (user.role === 'operator') return i.to !== '/daily-entry';
      return i.to !== '/floor';
    });

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur safe-pb print:hidden">
      <div className="flex justify-around py-2">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-1 text-[10px] ${isActive ? 'text-amber-400' : 'text-slate-500'}`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={toggle}
          className="flex flex-col items-center px-3 py-1 text-[10px] text-slate-500"
          aria-label="Toggle light/dark mode"
        >
          <span className="text-lg leading-none">{theme === 'dark' ? '☀' : '☾'}</span>
          Theme
        </button>
      </div>
    </nav>
  );
}
