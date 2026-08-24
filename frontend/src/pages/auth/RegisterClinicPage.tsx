import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuthStore } from '@/stores/authStore';
import api from '@/api/client';
import { 
  Building2, UserCheck, ShieldCheck, CheckCircle2, 
  ArrowRight, ArrowLeft, Loader2, Sparkles, Stethoscope, HeartPulse 
} from 'lucide-react';

interface OnboardingFormValues {
  // Step 1: Clinic
  clinicName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  gstNumber: string;
  // Step 2: Admin
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  // Step 3: Plan
  planTier: 'starter' | 'professional' | 'enterprise';
}

export default function RegisterClinicPage() {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const login = useAuthStore((s) => s.login);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<OnboardingFormValues>({
    defaultValues: {
      clinicName: '',
      tagline: 'Excellence in Healthcare',
      address: '',
      phone: '',
      email: '',
      gstNumber: '',
      adminName: '',
      adminEmail: '',
      adminPhone: '',
      adminPassword: '',
      planTier: 'professional',
    }
  });

  const selectedPlan = watch('planTier');

  const onSubmit = async (data: OnboardingFormValues) => {
    setIsSubmitting(true);
    try {
      const resp = await api.post('/public/register-clinic', {
        clinic_name: data.clinicName,
        tagline: data.tagline,
        address: data.address,
        phone: data.phone,
        email: data.email,
        gst_number: data.gstNumber || undefined,
        admin_name: data.adminName,
        admin_email: data.adminEmail,
        admin_phone: data.adminPhone,
        admin_password: data.adminPassword,
        plan_tier: data.planTier,
      });

      const { accessToken, profile } = resp.data;
      if (accessToken && profile) {
        login(profile, accessToken);
      }

      toast({
        title: "Hospital ERP Provisioned Successfully!",
        description: `Welcome to MediCare ERP, ${data.adminName}. Your 14-day trial has begun.`,
        variant: "success",
      });

      navigate('/admin');
    } catch (err: any) {
      toast({
        title: "Registration Failed",
        description: err.response?.data?.message || err.message || "Could not register clinic.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex flex-col justify-center items-center p-4">
      {/* Brand Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-2xl border border-teal-500/20 mb-3 shadow-lg shadow-teal-500/10">
          <HeartPulse className="h-9 w-9 text-teal-400" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">MediCare ERP Cloud</h1>
        <p className="text-stone-400 text-sm mt-1">Start your 14-day free hospital & clinic management trial</p>
      </div>

      {/* Stepper indicator */}
      <div className="flex items-center justify-center gap-2 mb-6 text-xs font-semibold">
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${step >= 1 ? 'bg-teal-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>
          <span>1</span> Hospital Info
        </div>
        <span className="text-slate-600">→</span>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${step >= 2 ? 'bg-teal-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>
          <span>2</span> Administrator
        </div>
        <span className="text-slate-600">→</span>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${step >= 3 ? 'bg-teal-500 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}>
          <span>3</span> SaaS Plan
        </div>
      </div>

      <Card className="w-full max-w-xl border-slate-800 bg-slate-900/90 text-white shadow-2xl backdrop-blur">
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* STEP 1: Hospital Details */}
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-teal-400">
                  <Building2 className="h-5 w-5" /> Hospital / Clinic Profile
                </CardTitle>
                <CardDescription className="text-stone-400">
                  Enter your hospital or polyclinic identity and location.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-stone-300">Hospital / Clinic Name *</Label>
                  <Input 
                    placeholder="e.g. Apex Multi-Specialty Hospital"
                    className="bg-slate-950/60 border-slate-700"
                    {...register('clinicName', { required: 'Clinic name is required' })}
                  />
                  {errors.clinicName && <p className="text-xs text-rose-400">{errors.clinicName.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">Official Email *</Label>
                    <Input 
                      type="email"
                      placeholder="contact@apexhospital.in"
                      className="bg-slate-950/60 border-slate-700"
                      {...register('email', { required: 'Email is required' })}
                    />
                    {errors.email && <p className="text-xs text-rose-400">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">Contact Number *</Label>
                    <Input 
                      placeholder="+91 98765 43210"
                      className="bg-slate-950/60 border-slate-700"
                      {...register('phone', { required: 'Phone is required' })}
                    />
                    {errors.phone && <p className="text-xs text-rose-400">{errors.phone.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-stone-300">Address / Location *</Label>
                  <Input 
                    placeholder="Sector 14, Ring Road, Mumbai, Maharashtra"
                    className="bg-slate-950/60 border-slate-700"
                    {...register('address', { required: 'Address is required' })}
                  />
                  {errors.address && <p className="text-xs text-rose-400">{errors.address.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">Tagline / Motto</Label>
                    <Input 
                      placeholder="e.g. Caring for Life"
                      className="bg-slate-950/60 border-slate-700"
                      {...register('tagline')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">GSTIN Number (Optional)</Label>
                    <Input 
                      placeholder="27AAAAA0000A1Z5"
                      className="bg-slate-950/60 border-slate-700 font-mono text-xs uppercase"
                      {...register('gstNumber')}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
                <Link to="/login" className="text-sm text-teal-400 hover:underline">
                  Already registered? Sign In
                </Link>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (watch('clinicName') && watch('email') && watch('phone') && watch('address')) {
                      setStep(2);
                    } else {
                      toast({ title: 'Please fill all required fields', variant: 'destructive' });
                    }
                  }}
                  className="bg-teal-500 hover:bg-teal-600 text-black font-semibold"
                >
                  Continue to Admin <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 2: Super Admin Account */}
          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-teal-400">
                  <UserCheck className="h-5 w-5" /> Administrator Credentials
                </CardTitle>
                <CardDescription className="text-stone-400">
                  Create your master Super Admin login credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-stone-300">Administrator Full Name *</Label>
                  <Input 
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="bg-slate-950/60 border-slate-700"
                    {...register('adminName', { required: 'Name is required' })}
                  />
                  {errors.adminName && <p className="text-xs text-rose-400">{errors.adminName.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">Admin Login Email *</Label>
                    <Input 
                      type="email"
                      placeholder="admin@apexhospital.in"
                      className="bg-slate-950/60 border-slate-700"
                      {...register('adminEmail', { required: 'Admin email is required' })}
                    />
                    {errors.adminEmail && <p className="text-xs text-rose-400">{errors.adminEmail.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-stone-300">Admin Mobile Number *</Label>
                    <Input 
                      placeholder="+91 98765 43210"
                      className="bg-slate-950/60 border-slate-700"
                      {...register('adminPhone', { required: 'Mobile is required' })}
                    />
                    {errors.adminPhone && <p className="text-xs text-rose-400">{errors.adminPhone.message}</p>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-stone-300">Master Password *</Label>
                  <Input 
                    type="password"
                    placeholder="••••••••••••"
                    className="bg-slate-950/60 border-slate-700"
                    {...register('adminPassword', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                  />
                  {errors.adminPassword && <p className="text-xs text-rose-400">{errors.adminPassword.message}</p>}
                </div>
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>This administrator account has full authority to configure staff, doctors, EMR, pharmacy, and financial modules.</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="border-slate-700 text-stone-300">
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button 
                  type="button" 
                  onClick={() => {
                    if (watch('adminName') && watch('adminEmail') && watch('adminPhone') && watch('adminPassword')) {
                      setStep(3);
                    } else {
                      toast({ title: 'Please fill all administrator fields', variant: 'destructive' });
                    }
                  }}
                  className="bg-teal-500 hover:bg-teal-600 text-black font-semibold"
                >
                  Select Plan <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </CardFooter>
            </>
          )}

          {/* STEP 3: SaaS Subscription Plan Selection */}
          {step === 3 && (
            <>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-teal-400">
                  <Sparkles className="h-5 w-5" /> Select SaaS Subscription Tier
                </CardTitle>
                <CardDescription className="text-stone-400">
                  All plans include 14 days free trial. Zero credit card required to start.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Plan 1: Starter */}
                <div 
                  className={`p-3.5 border rounded-xl cursor-pointer transition-all ${selectedPlan === 'starter' ? 'border-teal-500 bg-teal-950/30' : 'border-slate-800 hover:border-slate-700'}`}
                  onClick={() => setValue('planTier', 'starter')}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-white">Starter Clinic Plan</div>
                      <div className="text-xs text-stone-400">Up to 3 Doctors • OPD & Prescription PDFs • Queue Screen</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-teal-400 text-base">₹1,499<span className="text-xs text-stone-400">/mo</span></div>
                      <div className="text-[10px] text-emerald-400 font-semibold">14 Days Free</div>
                    </div>
                  </div>
                </div>

                {/* Plan 2: Professional (Popular) */}
                <div 
                  className={`p-3.5 border rounded-xl cursor-pointer transition-all relative ${selectedPlan === 'professional' ? 'border-teal-500 bg-teal-950/40 shadow-lg shadow-teal-500/10' : 'border-slate-800 hover:border-slate-700'}`}
                  onClick={() => setValue('planTier', 'professional')}
                >
                  <span className="absolute -top-2.5 right-4 bg-teal-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Most Popular
                  </span>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        Professional Hospital <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />
                      </div>
                      <div className="text-xs text-stone-400">Up to 15 Doctors • EMR • Lab Abnormal Flagging • Pharmacy & Split GST</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-teal-400 text-base">₹3,999<span className="text-xs text-stone-400">/mo</span></div>
                      <div className="text-[10px] text-emerald-400 font-semibold">14 Days Free</div>
                    </div>
                  </div>
                </div>

                {/* Plan 3: Enterprise */}
                <div 
                  className={`p-3.5 border rounded-xl cursor-pointer transition-all ${selectedPlan === 'enterprise' ? 'border-teal-500 bg-teal-950/30' : 'border-slate-800 hover:border-slate-700'}`}
                  onClick={() => setValue('planTier', 'enterprise')}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-bold text-sm text-white">Enterprise Multi-Branch</div>
                      <div className="text-xs text-stone-400">Unlimited Doctors • Multi-Branch • AI Clinical Summarizer • Razorpay & SMS</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-teal-400 text-base">₹9,999<span className="text-xs text-stone-400">/mo</span></div>
                      <div className="text-[10px] text-emerald-400 font-semibold">14 Days Free</div>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="border-slate-700 text-stone-300">
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-teal-500 hover:bg-teal-600 text-black font-bold px-6"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Provisioning Hospital ERP...
                    </>
                  ) : (
                    'Launch Hospital ERP'
                  )}
                </Button>
              </CardFooter>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
