import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { AssistantWidget } from '../ai/AssistantWidget';

export const AppShell: React.FC = () => {
  const { sidebarOpen } = useUIStore();

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-900">
      <Sidebar />
      <div className={cn(
        "flex flex-col flex-1 transition-all duration-300 w-full",
        sidebarOpen ? "md:ml-64" : "md:ml-20"
      )}>
        <Topbar />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <AssistantWidget />
    </div>
  );
};
