import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  /** Called with the new checked state. Matches the Radix switch API. */
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Toggle switch built on a native checkbox input: the input itself is the
 * track, and the thumb is a sibling that slides when `:checked`.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => (
    <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
      <input
        type="checkbox"
        role="switch"
        ref={ref}
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          'peer h-5 w-9 cursor-pointer appearance-none rounded-full bg-input transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 h-4 w-4 rounded-full bg-background shadow-lg transition-transform peer-checked:translate-x-4"
      />
    </span>
  )
);
Switch.displayName = 'Switch';

export { Switch };
