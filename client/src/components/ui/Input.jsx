import { forwardRef } from 'react';

const Input = forwardRef(
  (
    {
      label,
      error,
      helper,
      leftIcon,
      rightIcon,
      className = '',
      containerClassName = '',
      ...props
    },
    ref
  ) => {
    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            >
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`input-field ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${
              error ? 'border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.12)]' : ''
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-400 font-medium">{error}</p>}
        {helper && !error && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {helper}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
