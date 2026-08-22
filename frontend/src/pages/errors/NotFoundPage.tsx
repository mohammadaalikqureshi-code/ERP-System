import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-sm border border-stone-200 p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="bg-rose-100 p-3 rounded-full">
            <AlertCircle className="w-12 h-12 text-rose-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-stone-900">404</h1>
          <h2 className="text-xl font-semibold text-stone-700">Page Not Found</h2>
          <p className="text-stone-500">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <Button 
          className="w-full bg-teal-600 hover:bg-teal-700" 
          onClick={() => navigate('/')}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};
