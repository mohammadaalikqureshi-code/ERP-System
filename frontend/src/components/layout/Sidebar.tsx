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
  Shield,
  SlidersHorizontal,
  UserCog,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/lib/constants';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useEnabledPanels } from '@/api/settings';
import { Button } from '@/components/ui/button';

/**
 * A navigation entry. `panel` ties the link to a switchable panel — if the
 * clinic has that panel turned off, the link is not rendered at all.
 */
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
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Building2, label: 'Clinics', path: '/admin/clinics' },
    { icon: UserCog, label: 'Doctors', path: '/admin/doctors' },
    { icon: Users, label: 'Staff', path: '/admin/staff' },
    { icon: Receipt, label: 'Reports', path: '/admin/reports', panel: 'reports' },
    { icon: Bot, label: 'AI Assistant', path: '/admin/ai', panel: 'ai_assistant' },
    { icon: SlidersHorizontal, label: 'Panels', path: '/admin/panels' },
    { icon: KeyRound, label: 'API Keys', path: '/admin/api-keys' },
    { icon: Shield, label: 'Audit Logs', path: '/admin/audit' },
  ],
  clinic_admin: [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Building2, label: 'Clinics', path: '/admin/clinics' },
    { icon: UserCog, label: 'Doctors', path: '/admin/doctors' },
    { icon: Users, label: 'Staff', path: '/admin/staff' },
    { icon: Receipt, label: 'Reports', path: '/admin/reports', panel: 'reports' },
    { icon: Bot, label: 'AI Assistant', path: '/admin/ai', panel: 'ai_assistant' },
    { icon: SlidersHorizontal, label: 'Panels', path: '/admin/panels' },
    { icon: KeyRound, label: 'API Keys', path: '/admin/api-keys' },
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

  // Until the panel list has loaded, show everything rather than flashing an
  // empty sidebar.
  const items = (NAV_BY_ROLE[role] || []).filter(
    (item) => !item.panel || !enabled || enabled.includes(item.panel)
  );

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col bg-stone-900 text-stone-300 transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-20 -translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-stone-800 px-4">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="flex-shrink-0 rounded-lg bg-teal-600 p-1.5">
              <Activity className="h-5 w-5 text-white" />
            </div>
            {sidebarOpen && (
              <span className="whitespace-nowrap font-semibold text-white">{APP_NAME}</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden rounded-md p-1 hover:bg-stone-800 md:block"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={`${item.path}-${item.label}`}>
                  <NavLink
                    to={item.path}
                    end={item.path.split('/').length <= 2}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-md px-3 py-2.5 transition-colors',
                        isActive
                          ? 'bg-teal-600/10 text-teal-400'
                          : 'hover:bg-stone-800 hover:text-white'
                      )
                    }
                    onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {sidebarOpen && <span className="ml-3 truncate">{item.label}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-stone-800 p-4">
          <div className={cn('flex items-center', sidebarOpen ? 'justify-between' : 'justify-center')}>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {user?.fullName || user?.name || 'User'}
                </p>
                <p className="truncate text-xs capitalize text-stone-500">
                  {role.replace('_', ' ')}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-stone-400 hover:bg-stone-800 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};
