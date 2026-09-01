const Card = ({ children, className = '', hover = false, onClick, ...props }) => {
  return (
    <div
      className={`${hover ? 'card-hover' : 'card'} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export const GlassCard = ({ children, className = '', strong = false, ...props }) => (
  <div className={`${strong ? 'glass-card-strong' : 'glass-card'} p-6 ${className}`} {...props}>
    {children}
  </div>
);

export const StatCard = ({ value, label, icon, className = '' }) => (
  <div className={`stat-card ${className}`}>
    {icon && <div className="text-2xl mb-1">{icon}</div>}
    <div className="stat-value">{value ?? '—'}</div>
    <div className="stat-label">{label}</div>
  </div>
);

export default Card;
