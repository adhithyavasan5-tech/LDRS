import { NavLink } from 'react-router-dom';
import {
  Home,
  Film,
  Clock,
  Bookmark,
  Heart,
  Settings,
  PlusCircle,
  LogIn,
} from 'lucide-react';

const navItems = [
  { path: '/home', icon: Home, label: 'Home' },
  { path: '/create-room', icon: PlusCircle, label: 'Create Date' },
  { path: '/join-room', icon: LogIn, label: 'Join Date' },
  { path: '/history', icon: Clock, label: 'History' },
  { path: '/watchlist', icon: Bookmark, label: 'Watchlist' },
  { path: '/couple', icon: Heart, label: 'Our Space' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col pt-16 pb-6 border-r transition-transform duration-300
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-56 md:w-56`}
        style={{
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <nav className="flex-1 px-3 pt-2 space-y-0.5">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${
                  isActive
                    ? 'bg-primary-600/20 text-primary-300 border border-primary-600/30'
                    : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) =>
                !isActive ? { color: 'var(--text-secondary)' } : {}
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 mt-4">
          <div
            className="text-xs px-3 py-2 rounded-lg"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-glass)' }}
          >
            <span className="font-display italic">Together, always ❤️</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
