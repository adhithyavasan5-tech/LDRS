import { Heart } from 'lucide-react';

const Loader = ({ size = 'md', message = '' }) => {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className={`${sizes[size]} relative`}>
        <div
          className="absolute inset-0 rounded-full border-2 border-primary-500/30 animate-spin"
          style={{ borderTopColor: 'rgba(168,85,247,0.8)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart className="w-3 h-3 text-accent-400 animate-pulse" fill="currentColor" />
        </div>
      </div>
      {message && (
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {message}
        </p>
      )}
    </div>
  );
};

export const PageLoader = ({ message = 'Loading...' }) => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader size="lg" message={message} />
  </div>
);

export default Loader;
