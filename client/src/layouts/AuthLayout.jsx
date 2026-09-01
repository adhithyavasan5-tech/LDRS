import { Outlet } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const AuthLayout = () => (
  <div
    className="min-h-screen flex flex-col"
    style={{
      background: 'var(--bg-primary)',
      backgroundImage: 'var(--tw-bg-hero-dark)',
    }}
  >
    {/* Ambient gradient orbs */}
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.4), transparent)' }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-15"
        style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.4), transparent)' }}
      />
    </div>

    {/* Logo */}
    <header className="relative z-10 flex justify-center pt-8 pb-4">
      <Link to="/" className="flex items-center gap-2 group">
        <Heart
          className="w-6 h-6 text-accent-500 group-hover:scale-110 transition-transform"
          fill="currentColor"
        />
        <span className="font-display text-2xl font-medium gradient-text">LDRS</span>
      </Link>
    </header>

    {/* Content */}
    <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </main>

    {/* Footer */}
    <footer className="relative z-10 text-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
      Break the distance, together in every moment ❤️
    </footer>
  </div>
);

export default AuthLayout;
