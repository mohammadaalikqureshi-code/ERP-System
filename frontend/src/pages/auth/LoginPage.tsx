import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm as useHookForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import apiClient from '@/api/client';
import { ROLE_ROUTES } from '@/lib/constants';
import { useToast } from '@/components/ui/use-toast';
import { Activity, KeyRound, Lock, Mail, ArrowLeft, CheckCircle2, ShieldCheck, FileText, HeartPulse } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/authStore';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { parseJwtPayload } from '@/lib/jwt';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setClinicId = useAuthStore((state) => state.setClinicId);
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // OTP Login Tab State
  const [otpStep, setOtpStep] = useState(false);
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpDebugCode, setOtpDebugCode] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);

  // Forgot Password Modal State
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotDebugCode, setForgotDebugCode] = useState<string | null>(null);
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useHookForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  // On mount: Load remembered identifier from localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem('medicare_remember_identifier');
    if (savedEmail) {
      setValue('identifier', savedEmail, { shouldValidate: true });
      setRememberMe(true);
    }
  }, [setValue]);

  const DEMO_ACCOUNTS = [
    { label: 'Super Admin', email: 'admin@medicare-erp.in', role: 'Platform Super Admin' },
    { label: 'Hospital Admin', email: 'neha.kulkarni@sanjeevanihospital.in', role: 'Clinic Administrator' },
    { label: 'Dr. Meera Raghavan', email: 'meera.raghavan@sanjeevanihospital.in', role: 'Cardiology' },
    { label: 'Dr. Fatima Sheikh', email: 'fatima.sheikh@sanjeevanihospital.in', role: 'Paediatrics' },
    { label: 'Dr. Arjun Deshmukh', email: 'arjun.deshmukh@sanjeevanihospital.in', role: 'General Medicine' },
    { label: 'Dr. Vikram Nair', email: 'vikram.nair@sanjeevanihospital.in', role: 'Orthopaedics' },
    { label: 'Dr. Ananya Bose', email: 'ananya.bose@sanjeevanihospital.in', role: 'Dermatology' },
    { label: 'Dr. Rohit Malhotra', email: 'rohit.malhotra@sanjeevanihospital.in', role: 'Gynaecology' },
    { label: 'Receptionist', email: 'priya.menon@sanjeevanihospital.in', role: 'Front Desk & Billing' },
    { label: 'Lab Tech', email: 'mohammad.aalikqureshi@sanjeevanihospital.in', role: 'Diagnostics Laboratory' },
    { label: 'Pharmacist', email: 'imran.qureshi@sanjeevanihospital.in', role: 'Pharmacy Inventory' },
    { label: 'Staff Nurse', email: 'sunita.yadav@sanjeevanihospital.in', role: 'Inpatient Care' },
  ];

  const fillDemoAccount = (email: string) => {
    setValue('identifier', email, { shouldValidate: true });
    setValue('password', 'Medicare@2026', { shouldValidate: true });
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      // Remember me logic
      if (rememberMe) {
        localStorage.setItem('medicare_remember_identifier', data.identifier);
      } else {
        localStorage.removeItem('medicare_remember_identifier');
      }

      const response = await apiClient.post('/auth/login', {
        emailOrPhone: data.identifier,
        password: data.password,
      });
      const resData = response.data || {};
      const accessToken = resData.accessToken || resData.token || '';
      const profile = resData.profile || resData.user || {};

      setAuth(profile, accessToken);
      
      let role = profile?.role;
      if (!role && accessToken) {
        const jwtData = parseJwtPayload(accessToken);
        role = jwtData?.role || jwtData?.role_name;
      }

      if (profile?.clinicId) {
        setClinicId(profile.clinicId);
      }
      
      const target = (role && ROLE_ROUTES[role]) ? ROLE_ROUTES[role] : '/doctor';
      navigate(target, { replace: true });
    } catch (error: any) {
      toast({
        title: 'Sign In Failed',
        description: error.message || 'Invalid email/phone or password',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // OTP Login Flow
  const handleRequestOtp = async () => {
    if (!otpPhone.trim()) {
      toast({ title: 'Validation Error', description: 'Enter a valid mobile number', variant: 'destructive' });
      return;
    }
    setIsOtpLoading(true);
    try {
      const response = await apiClient.post('/auth/otp/request', { phone: otpPhone });
      setOtpDebugCode(response.data.debugCode || null);
      if (response.data.debugCode) {
        setOtpCode(response.data.debugCode);
      }
      setOtpStep(true);
      toast({
        title: 'OTP Transmitted',
        description: response.data.message || 'One-time verification code has been sent.',
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send OTP', variant: 'destructive' });
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      toast({ title: 'Validation Error', description: 'Enter the verification code', variant: 'destructive' });
      return;
    }
    setIsOtpLoading(true);
    try {
      const response = await apiClient.post('/auth/otp/verify', { phone: otpPhone, otp: otpCode });
      const { accessToken, profile } = response.data;
      setAuth(profile, accessToken);
      if (profile?.clinicId) {
        setClinicId(profile.clinicId);
      }
      const target = profile?.role ? ROLE_ROUTES[profile.role] || '/' : '/patient/dashboard';
      navigate(target, { replace: true });
    } catch (error: any) {
      toast({ title: 'Invalid OTP', description: error.message || 'Invalid or expired OTP code', variant: 'destructive' });
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Forgot Password Flow
  const handleOpenForgot = () => {
    const currentId = getValues('identifier');
    setForgotIdentifier(currentId || '');
    setForgotStep('request');
    setForgotOtp('');
    setForgotNewPassword('');
    setForgotConfirmPassword('');
    setForgotDebugCode(null);
    setIsForgotOpen(true);
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      toast({ title: 'Required Field', description: 'Enter your registered email or phone', variant: 'destructive' });
      return;
    }
    setIsForgotLoading(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', {
        emailOrPhone: forgotIdentifier.trim(),
      });
      setForgotDebugCode(res.data.debugCode || null);
      if (res.data.debugCode) {
        setForgotOtp(res.data.debugCode);
      }
      setForgotStep('reset');
      toast({
        title: 'Reset Code Sent',
        description: res.data.message || 'A 6-digit verification code has been dispatched.',
      });
    } catch (error: any) {
      toast({
        title: 'Request Failed',
        description: error.message || 'Unable to find account or send code.',
        variant: 'destructive',
      });
    } finally {
      setIsForgotLoading(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      toast({ title: 'Validation Error', description: 'Enter the verification code', variant: 'destructive' });
      return;
    }
    if (forgotNewPassword.length < 6) {
      toast({ title: 'Weak Password', description: 'New password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      toast({ title: 'Password Mismatch', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setIsForgotLoading(true);
    try {
      const res = await apiClient.post('/auth/reset-password', {
        emailOrPhone: forgotIdentifier.trim(),
        otp: forgotOtp.trim(),
        newPassword: forgotNewPassword,
      });

      toast({
        title: 'Password Updated Successfully! 🎉',
        description: res.data.message || 'You can now sign in with your new password.',
      });

      // Auto-fill login form with new password
      setValue('identifier', forgotIdentifier.trim(), { shouldValidate: true });
      setValue('password', forgotNewPassword, { shouldValidate: true });

      setIsForgotOpen(false);
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.message || 'Invalid or expired reset code',
        variant: 'destructive',
      });
    } finally {
      setIsForgotLoading(false);
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
                      className={errors.identifier ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
                      className={errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}
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
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-stone-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-stone-900 dark:text-stone-300 cursor-pointer select-none">
                      Remember me
                    </label>
                  </div>

                  <div className="text-sm">
                    <button
                      type="button"
                      onClick={handleOpenForgot}
                      className="font-medium text-teal-600 hover:text-teal-500 focus:outline-none transition-colors"
                    >
                      Forgot your password?
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold" disabled={isLoading}>
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
                      <Label htmlFor="phone">Mobile Number</Label>
                      <div className="mt-1">
                        <Input
                          id="phone"
                          type="tel"
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          placeholder="e.g. 9876543210"
                        />
                      </div>
                      <p className="text-xs text-stone-500 mt-1">We'll send a 6-digit verification code to your phone.</p>
                    </div>
                    <Button
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                      disabled={isOtpLoading}
                      onClick={handleRequestOtp}
                    >
                      {isOtpLoading ? <LoadingSpinner size="sm" className="mr-2 text-white" /> : null}
                      Request OTP Code
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="otp">Enter Verification Code</Label>
                      <div className="mt-1">
                        <Input
                          id="otp"
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="• • • • • •"
                          className="text-center tracking-widest text-lg font-mono font-bold"
                        />
                      </div>
                      {otpDebugCode && (
                        <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-950/40 rounded-md border border-teal-200 dark:border-teal-800 text-xs text-teal-700 dark:text-teal-300 flex items-center justify-between">
                          <span>Demo Code: <strong>{otpDebugCode}</strong></span>
                          <button
                            type="button"
                            onClick={() => setOtpCode(otpDebugCode)}
                            className="text-[11px] underline font-semibold text-teal-800 dark:text-teal-200"
                          >
                            Auto-Fill
                          </button>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-stone-500 text-center">
                        Code sent to {otpPhone}.{' '}
                        <button onClick={() => setOtpStep(false)} className="text-teal-600 font-medium">
                          Change number
                        </button>
                      </p>
                    </div>
                    <Button
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                      disabled={isOtpLoading}
                      onClick={handleVerifyOtp}
                    >
                      {isOtpLoading ? <LoadingSpinner size="sm" className="mr-2 text-white" /> : null}
                      Verify & Sign In
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Quick 1-Click Demo Accounts */}
          <div className="mt-6 pt-6 border-t border-stone-200 dark:border-stone-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3 text-center">
              Quick Sign-in (Demo Accounts & Portals)
            </p>

            {/* Direct Patient Panel Card */}
            <Link
              to="/reports"
              className="flex items-center justify-between p-3 mb-3 rounded-xl border-2 border-teal-500/60 bg-gradient-to-r from-teal-50 via-teal-50/40 to-emerald-50/50 dark:from-teal-950/40 dark:via-teal-900/20 dark:to-emerald-950/30 hover:border-teal-600 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-600 text-white rounded-lg group-hover:scale-105 transition-transform shadow-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-teal-950 dark:text-teal-200 flex items-center gap-1.5">
                    <span>🏥 Patient Panel & Reports</span>
                    <span className="text-[10px] uppercase px-2 py-0.5 bg-teal-200/80 dark:bg-teal-800 text-teal-900 dark:text-teal-100 rounded-full font-extrabold">
                      Zero Login
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-700/80 dark:text-teal-400">
                    Click to view Diagnostic Reports, Prescriptions & Bills
                  </div>
                </div>
              </div>
              <span className="text-base font-bold text-teal-600 group-hover:translate-x-1 transition-transform pr-1">→</span>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemoAccount(acc.email)}
                  className="flex flex-col items-start p-2.5 rounded-lg border border-stone-200 dark:border-stone-800 hover:border-teal-500 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 text-left transition-all group"
                >
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200 group-hover:text-teal-600">
                    {acc.label}
                  </span>
                  <span className="text-[10px] text-stone-400 truncate w-full">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Register New Hospital CTA */}
          <div className="mt-5 pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2 text-center">
            <div>
              <Link
                to="/reports"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
              >
                <span>📄 Looking for your Medical Reports? Search Reports (No login needed)</span>
                <span>→</span>
              </Link>
            </div>
            <div>
              <Link
                to="/register"
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
              >
                <span>🏥 New Hospital or Clinic? Start 14-Day Free Trial</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal Dialog */}
      <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-stone-950 border-stone-200 dark:border-stone-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-stone-900 dark:text-white">
              <KeyRound className="w-5 h-5 text-teal-600" />
              Reset Your Password
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              {forgotStep === 'request'
                ? 'Enter your registered email or phone to receive a 6-digit recovery code.'
                : 'Enter the verification code and your new password.'}
            </DialogDescription>
          </DialogHeader>

          {forgotStep === 'request' ? (
            <form onSubmit={handleRequestResetOtp} className="space-y-4 py-2">
              <div>
                <Label htmlFor="forgot-id">Email Address or Phone Number</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <Input
                    id="forgot-id"
                    type="text"
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder="doctor@hospital.in or 9876543210"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsForgotOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isForgotLoading}
                  className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                >
                  {isForgotLoading ? <LoadingSpinner size="sm" className="mr-1 text-white" /> : null}
                  Send Recovery Code
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handleCompleteReset} className="space-y-4 py-2">
              <div>
                <Label htmlFor="forgot-otp">6-Digit Verification Code</Label>
                <Input
                  id="forgot-otp"
                  type="text"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value)}
                  placeholder="123456"
                  className="mt-1 font-mono tracking-widest text-center text-lg font-bold"
                  required
                />
                {forgotDebugCode && (
                  <div className="mt-2 p-2 bg-teal-50 dark:bg-teal-950/40 rounded-md border border-teal-200 dark:border-teal-800 text-xs text-teal-700 dark:text-teal-300 flex items-center justify-between">
                    <span>Demo Code: <strong>{forgotDebugCode}</strong></span>
                    <button
                      type="button"
                      onClick={() => setForgotOtp(forgotDebugCode)}
                      className="text-[11px] underline font-semibold text-teal-800 dark:text-teal-200"
                    >
                      Auto-Fill Code
                    </button>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="forgot-new-pwd">New Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <Input
                    id="forgot-new-pwd"
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="forgot-confirm-pwd">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                  <Input
                    id="forgot-confirm-pwd"
                    type="password"
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-col sm:flex-row justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForgotStep('request')}
                  className="gap-1 text-stone-500 self-start sm:self-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
                </Button>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsForgotOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isForgotLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                  >
                    {isForgotLoading ? <LoadingSpinner size="sm" className="mr-1 text-white" /> : null}
                    Save New Password
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

