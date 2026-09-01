const Badge = ({ children, variant = 'primary', className = '' }) => (
  <span className={`badge-${variant} ${className}`}>{children}</span>
);

export default Badge;

export const ConnectionBadge = ({ status }) => {
  const configs = {
    connected: { dot: 'connection-connected', label: 'Connected', color: 'text-emerald-400' },
    buffering: { dot: 'connection-buffering', label: 'Buffering', color: 'text-amber-400' },
    lost: { dot: 'connection-lost', label: 'Connection lost', color: 'text-red-400' },
    disconnected: { dot: 'connection-lost', label: 'Disconnected', color: 'text-red-400' },
  };

  const config = configs[status] || configs.disconnected;

  return (
    <div className="flex items-center gap-2">
      <span className={config.dot} />
      <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
    </div>
  );
};
