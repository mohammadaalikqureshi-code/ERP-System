import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Bot,
  Building2,
  Calendar,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Receipt,
  Settings,
  Shield,
  SlidersHorizontal,
  UserCog,
  Users,
  Stethoscope,
  Radio,
  Hospital,
  DollarSign,
  AlertOctagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useEnabledPanels } from '@/api/settings';
import { Button } from '@/components/ui/button';

interface NavItem {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  panel?: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  receptionist: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/reception', panel: 'reception' },
    { icon: Users, label: 'Patients', path: '/reception/patients', panel: 'reception' },
    { icon: Calendar, label: 'Appointments', path: '/reception/appointments', panel: 'reception' },
    { icon: ListOrdered, label: 'Queue', path: '/reception/queue', panel: 'reception' },
    { icon: Receipt, label: 'Billing', path: '/reception/billing', panel: 'reception' },
  ],
  nurse: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/reception', panel: 'reception' },
    { icon: ListOrdered, label: 'Queue', path: '/reception/queue', panel: 'reception' },
  ],
  doctor: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/doctor', panel: 'doctor' },
    { icon: CalendarDays, label: 'Schedule & Leaves', path: '/doctor/schedule', panel: 'doctor' },
  ],
  super_admin: [
    { icon: LayoutDashboard, label: 'Platform Overview', path: '/admin' },
    { icon: Building2, label: 'Hospitals & Branches', path: '/admin/clinics' },
    { icon: UserCog, label: 'Doctor Provisioning', path: '/admin/doctors' },
    { icon: Users, label: 'Staff Credential Authority', path: '/admin/staff' },
    { icon: Shield, label: 'Security & Audit Logs', path: '/admin/audit' },
    { icon: Receipt, label: 'Financial Reports', path: '/admin/reports', panel: 'reports' },
    { icon: SlidersHorizontal, label: 'System Panels', path: '/admin/panels' },
    { icon: KeyRound, label: 'API Keys & Secrets', path: '/admin/api-keys' },
    { icon: Bot, label: 'AI Platform Assistant', path: '/admin/ai', panel: 'ai_assistant' },
    { icon: Settings, label: 'Platform Settings', path: '/admin/settings' },
  ],
  clinic_admin: [
    { icon: Activity, label: 'Hospital Command Center', path: '/admin' },
    { icon: Stethoscope, label: 'Doctors & OPD Duty', path: '/admin/doctors' },
    { icon: Users, label: 'Staff Shift Directory', path: '/admin/staff' },
    { icon: Receipt, label: 'Shift Collections & Revenue', path: '/admin/reports', panel: 'reports' },
    { icon: Bot, label: 'AI Clinical Assistant', path: '/admin/ai', panel: 'ai_assistant' },
    { icon: Hospital, label: 'Hospital Profile & OPD', path: '/admin/settings' },
  ],
  pharmacist: [{ icon: LayoutDashboard, label: 'Inventory', path: '/inventory', panel: 'inventory' }],
  lab_staff: [{ icon: LayoutDashboard, label: 'Lab Dashboard', path: '/lab', panel: 'lab' }],
  patient: [{ icon: LayoutDashboard, label: 'Dashboard', path: '/patient/dashboard' }],
};

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { data: panels } = useEnabledPanels();

  const role = user?.role || 'receptionist';
  const enabled = panels?.enabled;

  const items = (NAV_BY_ROLE[role] || []).filter(
    (item) => !item.panel || !enabled || enabled.includes(item.panel)
  );

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
          'lg:static lg:translate-x-0',
          sidebarOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:w-16'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b px-4">
          <div
            className={cn(
              'flex items-center gap-2 overflow-hidden transition-all',
              !sidebarOpen && 'lg:hidden'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 font-bold text-white shadow-sm">
              M
            </div>
            <span className="font-semibold tracking-tight text-foreground truncate">
              {APP_NAME}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin' || item.path === '/reception' || item.path === '/doctor'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/50 dark:text-teal-200 shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !sidebarOpen && 'lg:justify-center lg:px-2'
                  )
                }
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />
                <span
                  className={cn(
                    'truncate transition-all duration-200',
                    !sidebarOpen && 'lg:hidden'
                  )}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t p-2">
          <div
            className={cn(
              'mb-2 flex items-center gap-3 px-3 py-2',
              !sidebarOpen && 'lg:justify-center lg:px-0'
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs font-bold">
              {user?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {sidebarOpen && (
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-xs font-medium text-foreground">
                  {user?.full_name || user?.email}
                </span>
                <span className="truncate text-[10px] text-muted-foreground uppercase font-semibold">
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive',
              !sidebarOpen && 'lg:justify-center lg:px-0'
            )}
            onClick={logout}
            title={!sidebarOpen ? 'Log out' : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn(!sidebarOpen && 'lg:hidden')}>Log out</span>
          </Button>
        </div>
      </aside>
    </>
  );
};
