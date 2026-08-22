import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import api from '@/api/client';

const loginSchema = z.object({
  mobile: z.string().min(10, 'Invalid mobile number'),
});

const otpSchema = z.object({
  otp: z.string().length(6, 'OTP must be 6 digits'),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type OTPFormValues = z.infer<typeof otpSchema>;

export default function PatientLogin() {
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { setAuth } = useAuthStore();
  
  const from = location.state?.from?.pathname || '/patient/dashboard';

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { mobile: '' },
  });

  const otpForm = useForm<OTPFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  });

  const onRequestOTP = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await api.post('/patient-portal/login/request', { mobile: data.mobile });
      setMobile(data.mobile);
      setStep(2);
      toast({ title: 'OTP Sent successfully' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to send OTP',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onVerifyOTP = async (data: OTPFormValues) => {
    setIsLoading(true);
    try {
      const response = await api.post('/patient-portal/login/verify', {
        mobile,
        otp: data.otp,
      });
      
      setAuth(response.data.profile || response.data.user, response.data.accessToken);
      
      toast({ title: 'Logged in successfully' });
      navigate(from, { replace: true });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Invalid OTP',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Patient Portal</CardTitle>
          <CardDescription>
            {step === 1 ? 'Enter your mobile number to receive an OTP' : 'Enter the 6-digit OTP sent to your mobile'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 ? (
            <form onSubmit={loginForm.handleSubmit(onRequestOTP)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <Input
                  id="mobile"
                  placeholder="e.g. 9876543210"
                  disabled={isLoading}
                  {...loginForm.register('mobile')}
                />
                {loginForm.formState.errors.mobile && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.mobile.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(onVerifyOTP)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">One-Time Password</Label>
                <Input
                  id="otp"
                  placeholder="123456"
                  maxLength={6}
                  disabled={isLoading}
                  {...otpForm.register('otp')}
                />
                {otpForm.formState.errors.otp && (
                  <p className="text-sm text-red-500">{otpForm.formState.errors.otp.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Verify & Login'}
              </Button>
              <div className="text-center mt-4 text-sm">
                <button
                  type="button"
                  className="text-teal-600 hover:underline"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                >
                  Change Mobile Number
                </button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex flex-col border-t pt-4">
           <Button variant="link" onClick={() => navigate('/login')} className="text-sm text-stone-500">
             Staff / Doctor Login <ArrowRight className="w-4 h-4 ml-2" />
           </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
