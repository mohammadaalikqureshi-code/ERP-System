import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trash2,
  Send,
  Stethoscope,
  FlaskConical,
  Pill,
  Receipt,
  AlertCircle,
  MessageSquare,
  Calendar,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  useInboxNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useClearAllNotifications,
  useSendNotification,
} from '@/api/notifications';
import { AppNotification } from '@/types';
import { cn } from '@/lib/utils';
import { useWebSocket } from '@/hooks/useWebSocket';

/** Play a subtle audio chime when a real-time notification is received */
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Audio context may be restricted by browser autoplay policy
  }
};

/** Format relative time */
const formatTimeAgo = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recent';
  }
};

/** Category icons and styles */
const getCategoryDetails = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'clinical':
      return {
        icon: Stethoscope,
        color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 border-teal-200 dark:border-teal-800',
        label: 'Clinical',
      };
    case 'appointment':
      return {
        icon: Calendar,
        color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800',
        label: 'Appointment',
      };
    case 'lab':
      return {
        icon: FlaskConical,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800',
        label: 'Laboratory',
      };
    case 'pharmacy':
      return {
        icon: Pill,
        color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800',
        label: 'Pharmacy',
      };
    case 'billing':
      return {
        icon: Receipt,
        color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800',
        label: 'Billing',
      };
    case 'urgent':
      return {
        icon: AlertCircle,
        color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800',
        label: 'Urgent Alert',
      };
    default:
      return {
        icon: MessageSquare,
        color: 'text-stone-600 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700',
        label: 'Notice',
      };
  }
};

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [ringing, setRinging] = useState(false);

  // Send message form state
  const [targetRole, setTargetRole] = useState('doctor');
  const [category, setCategory] = useState('clinical');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // Queries & Mutations
  const { data: inboxData, refetch } = useInboxNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead, isPending: isMarkingAll } = useMarkAllNotificationsRead();
  const { mutate: deleteNotification } = useDeleteNotification();
  const { mutate: clearAll, isPending: isClearingAll } = useClearAllNotifications();
  const { mutate: sendNotification, isPending: isSending } = useSendNotification();

  const unreadCount = inboxData?.unreadCount ?? 0;
  const notifications = inboxData?.items ?? [];

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  // Listen to WebSocket events for real-time live notification arrival
  useWebSocket({
    url: '/ws/queue',
    onMessage: (event) => {
      if (event.type === 'NOTIFICATION_RECEIVED' && event.data) {
        const notif = event.data as any;
        const userRole = user?.role;
        const isTarget =
          notif.targetRole === 'all' ||
          notif.targetRole === userRole ||
          notif.targetUserId === user?.id ||
          userRole === 'super_admin' ||
          userRole === 'clinic_admin';

        if (isTarget) {
          playNotificationSound();
          setRinging(true);
          setTimeout(() => setRinging(false), 2000);

          toast({
            title: `🔔 ${notif.title}`,
            description: `${notif.senderName ? `From ${notif.senderName}: ` : ''}${notif.message}`,
            action: notif.link ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => navigate(notif.link)}
              >
                View
              </Button>
            ) : undefined,
          });

          refetch();
        }
      }
    },
  });

  const handleNotificationClick = (item: AppNotification) => {
    if (!item.isRead) {
      markRead(item.id);
    }
    if (item.link) {
      setIsOpen(false);
      navigate(item.link);
    }
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Title and message are required',
        variant: 'destructive',
      });
      return;
    }

    sendNotification(
      {
        targetRole,
        category,
        title,
        message,
        link:
          targetRole === 'doctor'
            ? '/doctor'
            : targetRole === 'receptionist'
            ? '/reception/queue'
            : targetRole === 'lab_staff'
            ? '/lab'
            : targetRole === 'pharmacist'
            ? '/inventory'
            : '/admin',
      },
      {
        onSuccess: () => {
          toast({
            title: 'Notification Sent Live!',
            description: `Live alert dispatched to ${targetRole.replace('_', ' ')} panel.`,
          });
          setIsSendModalOpen(false);
          setTitle('');
          setMessage('');
        },
        onError: (err: any) => {
          toast({
            title: 'Failed to Send',
            description: err.message || 'Error dispatching notification',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'relative rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-transform',
              ringing && 'animate-bounce text-teal-600'
            )}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 text-stone-600 dark:text-stone-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-600 px-1 text-[11px] font-bold text-white shadow-md ring-2 ring-white dark:ring-stone-950 animate-in zoom-in-50">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-96 md:w-[420px] p-0 shadow-2xl rounded-2xl border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-900 dark:text-white text-base">Notifications</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 text-xs font-semibold px-2 py-0.5">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSendModalOpen(true)}
                className="h-8 px-2.5 text-xs text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 gap-1"
                title="Send Live Inter-Panel Alert"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Alert</span>
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllRead()}
                  disabled={isMarkingAll}
                  className="h-8 px-2 text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 pt-2.5 pb-1.5 border-b border-stone-100 dark:border-stone-800">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-8 bg-stone-100 dark:bg-stone-900 p-0.5">
                <TabsTrigger value="all" className="text-xs h-7">
                  All ({notifications.length})
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs h-7">
                  Unread ({unreadCount})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Notification Items List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-stone-100 dark:divide-stone-900">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-stone-800 dark:text-stone-200">
                  {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Live updates from doctors, front desk, lab, and pharmacy will appear here automatically.
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const { icon: CategoryIcon, color, label } = getCategoryDetails(item.category);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                      'p-3.5 hover:bg-stone-50 dark:hover:bg-stone-900/60 transition-colors cursor-pointer flex gap-3 items-start group relative',
                      !item.isRead && 'bg-teal-50/30 dark:bg-teal-950/20'
                    )}
                  >
                    {/* Unread dot */}
                    {!item.isRead && (
                      <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-teal-600" />
                    )}

                    {/* Category Icon */}
                    <div className={cn('p-2 rounded-xl border flex-shrink-0 mt-0.5', color)}>
                      <CategoryIcon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 truncate">
                          {item.senderName || label}
                        </span>
                        <span className="text-[10px] text-stone-400 flex-shrink-0">
                          {formatTimeAgo(item.createdAt)}
                        </span>
                      </div>

                      <h4
                        className={cn(
                          'text-xs font-semibold text-stone-900 dark:text-stone-100 truncate',
                          !item.isRead && 'font-bold text-teal-950 dark:text-teal-100'
                        )}
                      >
                        {item.title}
                      </h4>

                      <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>

                      {item.link && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 dark:text-teal-400 mt-1.5 group-hover:underline">
                          View details <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    {/* Action buttons on hover */}
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => deleteNotification(item.id)}
                        className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2.5 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 flex items-center justify-between text-xs">
              <span className="text-stone-400 text-[11px]">
                Showing {filteredNotifications.length} notification{filteredNotifications.length === 1 ? '' : 's'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAll()}
                disabled={isClearingAll}
                className="h-7 text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Clear all
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Send Inter-Panel Alert Dialog */}
      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-900 dark:text-white">
              <Send className="w-5 h-5 text-teal-600" />
              Send Live Inter-Panel Notification
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Transmit an instant real-time alert or message to a specific hospital department or panel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendSubmit} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="target-role">Target Panel / Role</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger id="target-role" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">🩺 Doctor (OPD)</SelectItem>
                    <SelectItem value="receptionist">📋 Reception / Front Desk</SelectItem>
                    <SelectItem value="lab_staff">🧪 Diagnostic Lab</SelectItem>
                    <SelectItem value="pharmacist">💊 Pharmacy & Stock</SelectItem>
                    <SelectItem value="nurse">🏥 Nursing Station</SelectItem>
                    <SelectItem value="clinic_admin">🏛️ Hospital Admin</SelectItem>
                    <SelectItem value="all">📢 All Staff (Broadcast)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clinical">Clinical / Patient</SelectItem>
                    <SelectItem value="lab">Laboratory Request</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy / Medicine</SelectItem>
                    <SelectItem value="billing">Billing / Cashier</SelectItem>
                    <SelectItem value="urgent">🚨 Urgent Priority</SelectItem>
                    <SelectItem value="general">General Notice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Subject / Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Urgent: Patient in Room 3 needs lab sample"
                className="mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="message">Message Details</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type the exact information or report details to transmit live..."
                className="mt-1 min-h-[90px]"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSendModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSending}
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
              >
                <Send className="w-4 h-4" />
                {isSending ? 'Transmitting...' : 'Send Live Notification'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
