import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_ROUTES } from '@/lib/constants';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleGoHome = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    navigate(ROLE_ROUTES[user.role] || '/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 dark:bg-stone-900 px-4">
      <div className="bg-white dark:bg-stone-950 p-8 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 flex flex-col items-center max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 dark:bg-red-900/30 dark:text-red-400">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-2">Access Denied</h1>
        <p className="text-stone-500 dark:text-stone-400 mb-8">
          You do not have permission to view this page. Please contact your administrator if you believe this is an error.
        </p>
        <Button onClick={handleGoHome} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
};
