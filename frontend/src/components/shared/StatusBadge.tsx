import React from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  PlayCircle,
  HelpCircle,
  Stethoscope,
  SkipForward
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type StatusType = 
  | 'booked' | 'checked_in' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show' | 'skipped' // Appointments
  | 'pending' | 'paid' | 'failed' | 'refunded' // Payments
  | 'queued' | 'sent' | 'delivered'; // Notifications

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<string, { label: string, colorClass: string, icon: React.ElementType }> = {
  // Appointment statuses
  booked: { label: 'Booked', colorClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', icon: Clock },
  checked_in: { label: 'Checked In', colorClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', icon: CheckCircle },
  in_consultation: { label: 'In Consultation', colorClass: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800', icon: Stethoscope },
  completed: { label: 'Completed', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
  no_show: { label: 'No Show', colorClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', icon: AlertCircle },
  skipped: { label: 'Skipped', colorClass: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800', icon: SkipForward },
  
  // Payment statuses
  pending: { label: 'Pending', colorClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800', icon: Clock },
  paid: { label: 'Paid', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle },
  failed: { label: 'Failed', colorClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800', icon: XCircle },
  refunded: { label: 'Refunded', colorClass: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700', icon: AlertCircle },

  // Notification statuses
  queued: { label: 'Queued', colorClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', icon: Clock },
  sent: { label: 'Sent', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: PlayCircle },
  delivered: { label: 'Delivered', colorClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', icon: CheckCircle },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showIcon = true }) => {
  const config = statusConfig[status.toLowerCase()] || { 
    label: status, 
    colorClass: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700', 
    icon: HelpCircle 
  };

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("px-2.5 py-0.5 font-medium border rounded-full capitalize whitespace-nowrap", config.colorClass, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1.5" />}
      {config.label}
    </Badge>
  );
};
