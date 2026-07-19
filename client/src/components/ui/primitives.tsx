import { ButtonHTMLAttributes, InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl bg-surface shadow-card border border-line/60', className)}>
      {children}
    </div>
  );
}

type BtnVariant = 'primary' | 'ghost' | 'outline';
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }
>(({ className, variant = 'primary', ...props }, ref) => {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-ink shadow-sm',
    outline: 'border border-line bg-surface text-ink hover:bg-paper',
    ghost: 'text-muted hover:text-ink hover:bg-line/40',
  };
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 text-sm font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
});
Button.displayName = 'Button';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink',
        'placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', className)}>
      {children}
    </span>
  );
}
