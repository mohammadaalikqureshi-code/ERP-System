import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
      {Icon && (
        <div className="rounded-full bg-stone-100 p-4 mb-4 dark:bg-stone-800">
          <Icon className="h-8 w-8 text-stone-500 dark:text-stone-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-stone-900 dark:text-stone-100">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-stone-500 max-w-sm dark:text-stone-400">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-6 bg-teal-600 hover:bg-teal-700 text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
