import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search, User, FileText } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BranchSwitcher } from './BranchSwitcher';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export const Topbar: React.FC = () => {
  const { setSidebarOpen, sidebarOpen } = useUIStore();
  const { user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 border-b bg-white dark:bg-stone-950 dark:border-stone-800">
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div className="hidden md:flex items-center relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
          <Input 
            type="text" 
            placeholder="Search..." 
            className="pl-9 bg-stone-100 dark:bg-stone-900 border-none focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user?.role === 'super_admin' && (
          <div className="hidden sm:block text-sm font-medium text-stone-600 dark:text-stone-300">
            Global View
          </div>
        )}

        <Link to="/reports" target="_blank">
          <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400 border-teal-500/30 hover:bg-teal-50 dark:hover:bg-teal-950/30">
            <FileText className="h-3.5 w-3.5" /> Patient Reports
          </Button>
        </Link>

        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                <AvatarFallback>{user?.name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 dark:text-red-400">
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
