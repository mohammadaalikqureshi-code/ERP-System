import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Called with the new checked state. Matches the Radix checkbox API. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Accessible checkbox built on a native input, so `<Label htmlFor>` works and
 * keyboard/screen-reader behaviour comes for free.
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        ref={ref}
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          'peer h-4 w-4 cursor-pointer appearance-none rounded-sm border border-primary shadow',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
    </span>
  )
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
