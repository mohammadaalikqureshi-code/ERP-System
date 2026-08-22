import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/api/client';
import { ROLE_ROUTES } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';
import { Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore(state => state.setAuth);
  const setClinicId = useAuthStore(state => state.setClinicId);
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [otpStep, setOtpStep] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useHookForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/login', {
        emailOrPhone: data.identifier,
        password: data.password,
      });
      const { accessToken, profile } = response.data;
      setAuth(profile, accessToken);
      if (profile.clinicId) {
        setClinicId(profile.clinicId);
      }
      const target = from === '/' ? ROLE_ROUTES[profile.role] || '/' : from;
      navigate(target, { replace: true });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Login failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
        <Activity className="w-[800px] h-[800px] text-teal-600 absolute -top-40 -right-40" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <Activity className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-stone-900 dark:text-white">
          MediCare ERP
        </h2>
        <p className="mt-2 text-center text-sm text-stone-600 dark:text-stone-400">
          Sign in to your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-white dark:bg-stone-950 py-8 px-4 shadow-xl shadow-stone-200/50 dark:shadow-none sm:rounded-2xl sm:px-10 border border-stone-100 dark:border-stone-800">
          <Tabs defaultValue="password" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-stone-100 dark:bg-stone-900">
              <TabsTrigger value="password">Password Login</TabsTrigger>
              <TabsTrigger value="otp">OTP Login</TabsTrigger>
            </TabsList>
            
            <TabsContent value="password">
              <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <Label htmlFor="identifier">Email or Phone Number</Label>
                  <div className="mt-1">
                    <Input
                      id="identifier"
                      type="text"
                      autoComplete="username"
                      className={errors.identifier ? "border-red-500 focus-visible:ring-red-500" : ""}
                      {...register('identifier')}
                    />
                    {errors.identifier && (
                      <p className="mt-1 text-sm text-red-600">{errors.identifier.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="mt-1">
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className={errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-stone-300 rounded"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-stone-900 dark:text-stone-300">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <a href="#" className="font-medium text-teal-600 hover:text-teal-500">
                      Forgot your password?
                    </a>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white" disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" className="mr-2 text-white" /> : null}
                  Sign in
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="otp">
              <div className="space-y-6">
                {!otpStep ? (
                  <>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="mt-1">
                        <Input id="phone" type="tel" placeholder="+91" />
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white" 
                      onClick={() => setOtpStep(true)}
                    >
                      Request OTP
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="otp">Enter OTP</Label>
                      <div className="mt-1">
                        <Input id="otp" type="text" placeholder="• • • • • •" className="text-center tracking-widest text-lg" />
                      </div>
                      <p className="mt-2 text-xs text-stone-500 text-center">OTP sent to your phone. <button onClick={() => setOtpStep(false)} className="text-teal-600">Change number</button></p>
                    </div>
                    <Button 
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={() => handleSubmit(onSubmit)()}
                    >
                      Verify & Sign in
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
