import { Link, useLocation } from 'react-router-dom';
import { Heart, Sun, Moon, Monitor, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import Avatar from '../ui/Avatar';

const ThemeIcon = ({ theme }) => {
  if (theme === 'dark') return <Moon className="w-4 h-4" />;
  if (theme === 'light') return <Sun className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
};

const Navbar = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 py-3 border-b"
      style={{
        background: 'var(--bg-glass)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo + Mobile Menu Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="btn-ghost md:hidden p-2"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/home" className="flex items-center gap-2 group">
          <Heart
            className="w-5 h-5 text-accent-500 group-hover:scale-110 transition-transform"
            fill="currentColor"
          />
          <span className="font-display text-xl font-medium gradient-text">LDRS</span>
        </Link>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost p-2 rounded-lg"
          title={`Switch theme (current: ${theme})`}
          aria-label="Toggle theme"
        >
          <ThemeIcon theme={theme} />
        </button>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" />
            <span
              className="hidden sm:block text-sm font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              {user.name}
            </span>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className="btn-ghost p-2 rounded-lg text-red-400 hover:text-red-300"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

export default Navbar;
