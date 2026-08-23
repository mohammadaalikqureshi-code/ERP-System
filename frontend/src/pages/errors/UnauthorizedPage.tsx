import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_ROUTES } from '@/lib/constants';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleGoHome = () => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    const target = ROLE_ROUTES[user.role] || '/';
    navigate(target, { replace: true });
  };

  const handleSwitchAccount = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 px-4">
      <div className="bg-white dark:bg-stone-950 p-8 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 flex flex-col items-center max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 dark:bg-red-900/30 dark:text-red-400">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Access Denied</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-4">
          You do not have permission to view this section with your current role.
        </p>
        
        {user && (
          <div className="mb-6 p-3 rounded-lg bg-stone-100 dark:bg-stone-900 w-full text-xs text-stone-600 dark:text-stone-400">
            Signed in as: <strong className="text-stone-900 dark:text-white capitalize">{user.fullName || user.email} ({user.role?.replace('_', ' ')})</strong>
          </div>
        )}

        <div className="w-full space-y-2">
          <Button onClick={handleGoHome} className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go to My Panel ({user?.role ? user.role.replace('_', ' ') : 'Home'})
          </Button>

          <Button onClick={handleSwitchAccount} variant="outline" className="w-full gap-2 text-stone-600 dark:text-stone-300">
            <LogOut className="w-4 h-4" />
            Sign in with Another Account
          </Button>
        </div>
      </div>
    </div>
  );
};

