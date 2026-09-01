import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger:
    'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-red-600/80 hover:bg-red-500/90 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: '', // default — handled by variant
  lg: 'px-8 py-4 text-base',
  icon: 'p-2 !px-2 !py-2',
};

const Button = forwardRef(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClass = variants[variant] || variants.primary;
    const sizeClass = sizes[size] || '';

    return (
      <button
        ref={ref}
        className={`${baseClass} ${sizeClass} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
