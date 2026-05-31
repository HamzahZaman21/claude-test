import type { HTMLAttributes } from 'react';

/** Glassmorphic panel: translucent surface + blur + 1px border + soft shadow. */
export function GlassPanel({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={
        'rounded-3xl border border-border bg-surface-glass shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-md ' +
        className
      }
      {...rest}
    >
      {children}
    </div>
  );
}
