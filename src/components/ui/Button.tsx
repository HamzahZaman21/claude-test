import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-cyan text-cyan-fg hover:brightness-110 shadow-[0_0_24px_var(--color-cyan-glow)]',
  secondary:
    'bg-amber text-amber-fg hover:brightness-110 shadow-[0_0_24px_var(--color-amber-glow)]',
  ghost: 'bg-white/5 text-fg hover:bg-white/10 border border-border',
  danger: 'bg-assassin text-white hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 py-2 text-base',
  lg: 'min-h-12 px-6 py-3 text-lg',
};

/** Token-driven button: variants, focus ring, hover transition, ≥44px touch target. */
export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold ' +
        'transition-all duration-200 cursor-pointer ' +
        'focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ' +
        `${VARIANTS[variant]} ${SIZES[size]} ${className}`
      }
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
