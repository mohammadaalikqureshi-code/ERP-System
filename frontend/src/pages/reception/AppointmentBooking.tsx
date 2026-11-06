import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { appointmentCreateSchema } from '@/lib/validations';
import { useCreateAppointment, useQuickWalkinAppointment } from '@/api/appointments';
import { useDoctors, useAvailableSlots } from '@/api/doctors';
import { useSearchPatients } from '@/api/patients';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Zap,
  Calendar,
  Search,
  CheckCircle2,
  Printer,
  Sparkles,
  AlertTriangle,
  Clock,
  User,
  Stethoscope,
  Phone,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Flame,
  Check,
  ChevronRight,
  CalendarDays,
  Building2,
  BadgePercent,
  CheckCheck,
  Tag
} from 'lucide-react';
import { Patient, Doctor } from '@/types';
import { cleanDoctorName, formatDoctorName } from '@/lib/utils';

type BookingFormValues = z.infer<typeof appointmentCreateSchema>;

export const getDoctorDisplayName = (doc: any): string => {
  if (!doc) return 'Doctor';
  const raw =
    doc.user?.fullName ||
    doc.user?.full_name ||
    doc.fullName ||
    doc.full_name ||
    doc.name ||
    (doc.firstName && doc.firstName !== 'Doctor' ? `${doc.firstName} ${doc.lastName || ''}`.trim() : '') ||
    (doc.user ? `${doc.user.firstName || doc.user.first_name || ''} ${doc.user.lastName || doc.user.last_name || ''}`.trim() : '') ||
    (doc.department ? `${doc.department} Specialist` : 'Doctor');
  return cleanDoctorName(raw) || 'Doctor';
};

const AppointmentBookingContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'express' | 'advance'>('express');

  // =========================================================================
  // 1. EXPRESS WALK-IN TOKEN STATE
  // =========================================================================
  const [mobile, setMobile] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState<number | ''>(35);
  const [gender, setGender] = useState('male');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [notes, setNotes] = useState('');
  const [generatedSlip, setGeneratedSlip] = useState<any | null>(null);

  // Debounced Mobile Search for Existing Patient
  const debouncedMobile = useDebounce(mobile, 300);
  const { data: searchResults, isLoading: isSearchingMobile } = useSearchPatients(debouncedMobile);
  const existingPatient = searchResults?.find((p: any) => p.mobile?.includes(mobile) || p.patientCode === mobile);

  useEffect(() => {
    if (existingPatient && mobile.length >= 10) {
      setFullName(existingPatient.fullName || `${existingPatient.firstName || ''} ${existingPatient.lastName || ''}`.trim());
      if (existingPatient.age) setAge(existingPatient.age);
      if (existingPatient.gender) setGender(existingPatient.gender);
      if (existingPatient.bloodGroup) setBloodGroup(existingPatient.bloodGroup);
    }
  }, [existingPatient, mobile]);

  const { data: doctors = [], isLoading: loadingDoctors } = useDoctors();
  const quickWalkinMutation = useQuickWalkinAppointment();

  // Set default doctor once loaded
  useEffect(() => {
    if (doctors.length > 0 && !selectedDoctorId) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [doctors, selectedDoctorId]);

  const handleQuickTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile || mobile.length < 10) {
      toast({ title: "Invalid Mobile", description: "Please enter a valid 10-digit mobile number.", variant: "destructive" });
      return;
    }
    if (!selectedDoctorId) {
      toast({ title: "Select Doctor", description: "Please select a doctor for consultation.", variant: "destructive" });
      return;
    }

    try {
      const selectedDoc = doctors.find((d: any) => d.id === selectedDoctorId);
      const res = await quickWalkinMutation.mutateAsync({
        mobile,
        fullName: fullName || (existingPatient ? existingPatient.fullName : 'Walk-in Patient'),
        age: age ? Number(age) : 30,
        gender,
        bloodGroup,
        doctorId: selectedDoctorId,
        department: selectedDoc?.department || 'General OPD',
        isEmergency,
        notes,
      });

      setGeneratedSlip(res);
      if (res.isDuplicatePrevented || res.is_duplicate_prevented) {
        toast({
          title: `⚠️ Active Token #${res.tokenNumber || res.token_number} Already Exists!`,
          description: `Patient already in queue for ${formatDoctorName(res.doctor?.fullName || res.doctor?.name)} today. Duplicate token creation blocked.`,
          variant: "warning",
        });
      } else {
        toast({
          title: `🎟️ Token #${res.tokenNumber || res.token_number} Generated!`,
          description: `Added to ${formatDoctorName(res.doctor?.fullName || res.doctor?.name)}'s live queue (${res.queueStats?.estimatedWaitFormatted || ''}).`,
          variant: "success",
        });
      }
    } catch (err: any) {
      toast({
        title: "Token Generation Failed",
        description: err.response?.data?.message || err.message || "Could not generate token.",
        variant: "destructive",
      });
    }
  };

  const handlePrintSlip = () => {
    if (!generatedSlip) return;

    const tokenNum = generatedSlip.tokenNumber || generatedSlip.token_number || 'A-101';
    const patientName = generatedSlip.patient?.fullName || generatedSlip.patient?.full_name || 'Walk-in Patient';
    const patientCode = generatedSlip.patient?.patientCode || generatedSlip.patient?.patient_code || 'PT-00001';
    const doctorName = generatedSlip.doctor?.fullName || generatedSlip.doctor?.full_name || 'Doctor';
    const dept = generatedSlip.doctor?.department || 'General OPD';
    const room = generatedSlip.doctor?.room || 'Cabin 101';
    const fee = generatedSlip.doctor?.consultationFee || generatedSlip.doctor?.consultation_fee || 500;
    const wait = generatedSlip.queueStats?.estimatedWaitFormatted || generatedSlip.queueStats?.estimated_wait_formatted || 'Next in Line';
    const dateStr = generatedSlip.appointmentDate || new Date().toISOString().split('T')[0];
    const timeStr = generatedSlip.appointmentTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Token #${tokenNum} - Sanjeevani Hospital</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              width: 76mm;
              margin: 0 auto;
              padding: 16px 8px;
              color: #111;
              box-sizing: border-box;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #333;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .hospital-name {
              font-size: 13px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 10px;
              color: #444;
              margin-top: 2px;
            }
            .token-box {
              text-align: center;
              padding: 12px 0;
              border-bottom: 2px dashed #333;
              margin-bottom: 8px;
            }
            .token-label {
              font-size: 11px;
              text-transform: uppercase;
              font-weight: bold;
              letter-spacing: 1px;
              color: #444;
            }
            .token-number {
              font-size: 46px;
              font-weight: 900;
              font-family: "Courier New", monospace;
              margin: 4px 0;
              line-height: 1;
            }
            .wait-badge {
              display: inline-block;
              font-size: 10px;
              font-weight: bold;
              padding: 3px 8px;
              border: 1px solid #111;
              border-radius: 12px;
              margin-top: 4px;
            }
            .details {
              font-size: 11px;
              line-height: 1.7;
              border-bottom: 2px dashed #333;
              padding-bottom: 8px;
              margin-bottom: 8px;
            }
            .row {
              display: flex;
              justify-content: space-between;
            }
            .row span:first-child {
              color: #555;
            }
            .row span:last-child {
              font-weight: bold;
              text-align: right;
            }
            .footer {
              text-align: center;
              font-size: 9px;
              color: #555;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="hospital-name">Sanjeevani Multi-Specialty Hospital</div>
            <div class="subtitle">OPD Patient Token Receipt</div>
          </div>
          
          <div class="token-box">
            <div class="token-label">Live OPD Token</div>
            <div class="token-number">${tokenNum}</div>
            <div class="wait-badge">Est. Wait: ${wait}</div>
          </div>

          <div class="details">
            <div class="row"><span>Patient:</span> <span>${patientName}</span></div>
            <div class="row"><span>Patient ID:</span> <span>${patientCode}</span></div>
            <div class="row"><span>Doctor:</span> <span>${formatDoctorName(doctorName)}</span></div>
            <div class="row"><span>Department:</span> <span>${dept}</span></div>
            <div class="row"><span>Consultation Cabin:</span> <span>${room}</span></div>
            <div class="row"><span>OPD Fee:</span> <span>Rs. ${fee}</span></div>
            <div class="row"><span>Date & Time:</span> <span>${dateStr} ${timeStr}</span></div>
          </div>

          <div class="footer">
            <div>Please be seated in the <strong>OPD Waiting Lounge</strong>.</div>
            <div>Your token will be announced automatically on the TV screen.</div>
            <div style="margin-top: 6px; font-weight: bold;">*** Thank You ***</div>
          </div>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleResetExpress = () => {
    setGeneratedSlip(null);
    setMobile('');
    setFullName('');
    setAge(35);
    setNotes('');
    setIsEmergency(false);
  };

  // =========================================================================
  // 2. ADVANCE SCHEDULED APPOINTMENT (Multi-Step Form)
  // =========================================================================
  const [step, setStep] = useState(1);
  const [advancePatientSearch, setAdvancePatientSearch] = useState('');
  const debouncedAdvanceSearch = useDebounce(advancePatientSearch, 300);
  const { data: advancePatients } = useSearchPatients(debouncedAdvanceSearch);
  const { mutateAsync: createAppointment, isPending: isCreatingAdvance } = useCreateAppointment();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(appointmentCreateSchema),
    defaultValues: {
      patientId: '',
      doctorId: '',
      appointmentDate: format(new Date(), 'yyyy-MM-dd'),
      appointmentTime: '',
      visitType: 'NEW',
      notes: '',
    }
  });

  const advSelectedDoctorId = form.watch('doctorId');
  const advSelectedDate = form.watch('appointmentDate');
  const advSelectedPatientId = form.watch('patientId');
  const advSelectedTime = form.watch('appointmentTime');
  const advSelectedVisitType = form.watch('visitType');

  const advSelectedPatient = advancePatients?.find((p: any) => p.id === advSelectedPatientId);
  const advSelectedDoctor = doctors.find((d: any) => d.id === advSelectedDoctorId);
  const { data: slots, isLoading: loadingSlots } = useAvailableSlots(advSelectedDoctorId, advSelectedDate);

  // Available slots logic with sensible fallbacks
  const availableSlotsList = useMemo(() => {
    if (slots && slots.length > 0) {
      return slots.map(s => typeof s === 'string' ? { time: s, isAvailable: true } : s);
    }
    const defaultTimes = [
      '09:00', '09:20', '09:40', '10:00', '10:20', '10:40',
      '11:00', '11:20', '11:40', '12:00', '16:00', '16:20',
      '16:40', '17:00', '17:20', '17:40', '18:00'
    ];
    return defaultTimes.map(t => ({ time: t, isAvailable: true }));
  }, [slots]);

  const [bookingResult, setBookingResult] = useState<any>(null);

  const onAdvanceSubmit = async (data: BookingFormValues) => {
    try {
      const result = await createAppointment(data);
      setBookingResult(result);
      toast({
        title: "Appointment Scheduled",
        description: `Token Number: ${result.tokenNumber}`,
        variant: "success",
      });
      setStep(4);
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.response?.data?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
        <PageHeader
          title="Patient Intake & Appointment Hub"
          description="High-speed walk-in queue token dispensing, smart returning patient auto-detection, and advance slot scheduling."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reception/queue')}
            className="text-xs gap-1.5 rounded-xl border-teal-600/30 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-semibold"
          >
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            Live Queue Board
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <TabsList className="grid grid-cols-2 w-full max-w-md p-1 rounded-2xl bg-muted/70 backdrop-blur-md">
            <TabsTrigger
              value="express"
              className="gap-2 text-xs font-bold py-2.5 rounded-xl data-[state=active]:bg-card data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300 data-[state=active]:shadow-sm transition-all"
            >
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              ⚡ Express Walk-in (5s)
            </TabsTrigger>
            <TabsTrigger
              value="advance"
              className="gap-2 text-xs font-bold py-2.5 rounded-xl data-[state=active]:bg-card data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 data-[state=active]:shadow-sm transition-all"
            >
              <Calendar className="w-4 h-4 text-blue-500" />
              📅 Advance Slot Booking
            </TabsTrigger>
          </TabsList>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span>OPD Registry Live: <strong>{doctors.length} Doctors Available</strong></span>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: ⚡ EXPRESS WALK-IN TOKEN */}
        {/* ================================================================= */}
        <TabsContent value="express" className="space-y-6 pt-1 focus-visible:outline-none">
          <AnimatePresence mode="wait">
            {generatedSlip ? (
              /* REALISTIC THERMAL PRINT TOKEN SLIP */
              <motion.div
                key="slip"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="max-w-md mx-auto space-y-4"
              >
                <Card className="border-2 border-teal-600/70 shadow-2xl bg-card overflow-hidden rounded-3xl relative">
                  {/* Emergency Siren or Regular Header */}
                  <div
                    className={`p-4 text-white text-center space-y-1 relative overflow-hidden ${
                      generatedSlip.isEmergency || generatedSlip.is_emergency
                        ? 'bg-gradient-to-r from-rose-600 to-red-700'
                        : 'bg-gradient-to-r from-teal-600 to-emerald-700'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-widest font-extrabold opacity-90">
                      Sanjeevani Multi-Specialty Hospital
                    </div>
                    <div className="text-sm font-black flex items-center justify-center gap-1.5">
                      {generatedSlip.isEmergency || generatedSlip.is_emergency ? (
                        <>
                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                          🚨 CRITICAL EMERGENCY TOKEN
                        </>
                      ) : (
                        'OPD Patient Queue Slip'
                      )}
                    </div>

                    {(generatedSlip.isEmergency || generatedSlip.is_emergency) && (
                      <div className="mt-2 py-1 px-3 rounded-lg bg-black/40 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                        <Flame className="w-3.5 h-3.5 fill-current" />
                        Priority 1: Front-of-Line Doctor Alert Broadcasted
                      </div>
                    )}

                    {(generatedSlip.isDuplicatePrevented || generatedSlip.is_duplicate_prevented) && (
                      <div className="mt-2 py-1 px-3 rounded-lg bg-amber-400 text-stone-950 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Active Queue Token Retained (Duplicate Prevented)
                      </div>
                    )}
                  </div>

                  <CardContent className="p-6 text-center space-y-4">
                    {/* Token Number Box with animated glow */}
                    <div className="py-3 border-b border-dashed border-border/80">
                      <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                        Allocated Token Number
                      </div>
                      <div className="text-6xl font-black font-mono text-teal-600 dark:text-teal-400 tracking-tight my-2 animate-token-glow">
                        {generatedSlip.tokenNumber || generatedSlip.token_number}
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 font-semibold text-xs border border-teal-200/60 shadow-xs">
                        <Clock className="w-3.5 h-3.5" />
                        {generatedSlip.queueStats?.estimatedWaitFormatted || 'Next in Line'}
                      </div>
                    </div>

                    {/* Receipt Details Grid */}
                    <div className="text-left text-xs space-y-2 py-3 border-b border-dashed border-border/80 bg-muted/20 p-3 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Patient:</span>
                        <span className="font-bold text-foreground">
                          {generatedSlip.patient?.fullName || generatedSlip.patient?.full_name} ({generatedSlip.patient?.patientCode || generatedSlip.patient?.patient_code})
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Consulting Doctor:</span>
                        <span className="font-bold text-teal-700 dark:text-teal-400">
                          {formatDoctorName(generatedSlip.doctor?.fullName || generatedSlip.doctor?.name)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Department & Cabin:</span>
                        <span className="font-semibold text-foreground">
                          {generatedSlip.doctor?.department} • {generatedSlip.doctor?.room || 'Cabin 101'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Consultation Fee:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{generatedSlip.doctor?.consultationFee || 500}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Date & Slot:</span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {generatedSlip.appointmentDate} • {generatedSlip.appointmentTime || 'Walk-in'}
                        </span>
                      </div>
                    </div>

                    {/* Instruction Box */}
                    <div className="p-3 bg-muted/40 rounded-2xl text-[11px] text-muted-foreground space-y-1 text-center border border-border/40">
                      <div>Please proceed to the <strong>OPD Waiting Area</strong>.</div>
                      <div>Your token will chime automatically on the central TV screen.</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2.5 pt-2">
                      <Button
                        onClick={handlePrintSlip}
                        className="flex-1 bg-stone-900 hover:bg-stone-800 text-white font-bold gap-2 text-xs h-10 rounded-xl shadow-md"
                      >
                        <Printer className="w-4 h-4" /> Print Thermal Slip
                      </Button>
                      <Button
                        onClick={handleResetExpress}
                        variant="outline"
                        className="flex-1 gap-2 text-xs h-10 rounded-xl border-dashed"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Next Patient (ESC)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              /* EXPRESS REGISTRATION FORM */
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleQuickTokenSubmit}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* LEFT COLUMN: Patient Identification (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <User className="w-4 h-4 text-teal-600" />
                          Step 1: Patient Identity
                        </CardTitle>
                        <span className="text-[10px] font-mono bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full font-bold">
                          ⚡ 5s Express
                        </span>
                      </div>
                      <CardDescription className="text-xs">
                        Enter 10-digit mobile number for instant profile lookup
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4 text-xs">
                      {/* Mobile Input with Real-time Check */}
                      <div className="space-y-1.5">
                        <Label htmlFor="mobile" className="font-semibold flex items-center justify-between">
                          <span>Mobile Number *</span>
                          {isSearchingMobile ? (
                            <span className="text-[10px] text-teal-600 animate-pulse font-medium">
                              Searching registry...
                            </span>
                          ) : mobile.length === 10 ? (
                            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Valid Mobile
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">10 digits required</span>
                          )}
                        </Label>
                        <div className="relative">
                          <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                          <Input
                            id="mobile"
                            type="tel"
                            placeholder="e.g. 9876543210"
                            className="pl-9 font-mono text-sm h-10 rounded-xl border-border/80 focus:ring-teal-500"
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            maxLength={10}
                            required
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Returning Patient Found Banner */}
                      <AnimatePresence>
                        {existingPatient && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-1 overflow-hidden"
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold text-xs text-emerald-700 dark:text-emerald-300">
                                <ShieldCheck className="w-4 h-4" /> Returning Patient Verified!
                              </span>
                              <span className="font-mono text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-800 dark:text-emerald-200 font-bold">
                                {existingPatient.patientCode}
                              </span>
                            </div>
                            <div className="font-bold text-foreground text-sm pt-0.5">
                              {existingPatient.fullName || `${existingPatient.firstName || ''} ${existingPatient.lastName || ''}`}
                            </div>
                            <div className="text-[11px] text-muted-foreground flex gap-2">
                              <span>Age: {existingPatient.age || 42} Y</span>
                              <span>•</span>
                              <span>Gender: {existingPatient.gender}</span>
                              <span>•</span>
                              <span>Blood: {existingPatient.bloodGroup || 'O+'}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Full Name Input */}
                      <div className="space-y-1.5">
                        <Label htmlFor="fullName" className="font-semibold">Patient Full Name *</Label>
                        <Input
                          id="fullName"
                          placeholder="e.g. Ramesh Chandra Verma"
                          className="h-9 text-xs rounded-xl"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>

                      {/* Age & Gender in 2 Columns */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="age" className="font-semibold">Age (Years)</Label>
                          <Input
                            id="age"
                            type="number"
                            placeholder="35"
                            className="h-9 text-xs font-mono rounded-xl"
                            value={age}
                            onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                            min={1}
                            max={120}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="gender" className="font-semibold">Gender</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="h-9 text-xs rounded-xl">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Blood Group Quick-Pills */}
                      <div className="space-y-1.5">
                        <Label className="font-semibold">Blood Group</Label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                            <button
                              key={bg}
                              type="button"
                              onClick={() => setBloodGroup(bg)}
                              className={`py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                                bloodGroup === bg
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                  : 'bg-muted/40 hover:bg-muted text-foreground border-border/60'
                              }`}
                            >
                              {bg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Brief Symptoms or Notes */}
                      <div className="space-y-1.5 pt-1">
                        <Label htmlFor="notes" className="font-semibold">Chief Complaint / Notes (Optional)</Label>
                        <Input
                          id="notes"
                          placeholder="e.g. Fever for 2 days, back pain"
                          className="h-9 text-xs rounded-xl"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* RIGHT COLUMN: Doctor Selection & Queue Dispatch (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <Card className="border shadow-sm rounded-3xl bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-3 border-b bg-muted/30">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-teal-600" />
                          Step 2: Consulting Doctor & Department
                        </CardTitle>
                        <span className="text-[11px] text-muted-foreground font-semibold">
                          {doctors.length} Doctors Active
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4 pt-4">
                      {loadingDoctors ? (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          Loading active doctor schedules...
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[310px] overflow-y-auto pr-1">
                          {doctors.map((doc: any) => {
                            const isSelected = selectedDoctorId === doc.id;
                            const name = getDoctorDisplayName(doc);
                            const fee = doc.consultationFee || 500;
                            const dept = doc.department || 'General OPD';

                            return (
                              <motion.div
                                key={doc.id}
                                whileHover={{ scale: 1.015 }}
                                whileTap={{ scale: 0.99 }}
                                onClick={() => setSelectedDoctorId(doc.id)}
                                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all duration-200 relative ${
                                  isSelected
                                    ? 'border-teal-600 bg-teal-500/10 dark:bg-teal-950/40 shadow-md ring-2 ring-teal-600/20'
                                    : 'border-border/60 hover:border-border bg-card'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center">
                                    <Check className="w-3 h-3" />
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="font-bold text-sm text-foreground pr-6">
                                    {formatDoctorName(name)}
                                  </div>
                                  <div className="text-xs font-semibold text-teal-700 dark:text-teal-400 flex items-center justify-between">
                                    <span>{dept}</span>
                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
                                      Series {doc.tokenPrefix || doc.token_prefix || 'A'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {doc.specialization || 'Consultant Physician'}
                                  </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    ₹{fee}
                                  </span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                                    Cabin Active
                                  </span>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {/* Emergency / Critical Case Selector */}
                      <div
                        className={`p-4 rounded-2xl border transition-all ${
                          isEmergency
                            ? 'bg-rose-500/15 border-rose-500/50 ring-2 ring-rose-500/30'
                            : 'bg-muted/20 border-border/60'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <div className="font-bold text-xs flex items-center gap-1.5">
                              <AlertTriangle className={`w-4 h-4 ${isEmergency ? 'text-rose-600 fill-rose-600' : 'text-amber-500'}`} />
                              <span className={isEmergency ? 'text-rose-700 dark:text-rose-300 font-black' : 'text-foreground'}>
                                Emergency Case?
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Bypasses queue order and places patient as Token #1 with immediate alert.
                            </div>
                          </div>

                          <Button
                            type="button"
                            variant={isEmergency ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => setIsEmergency(!isEmergency)}
                            className={`h-9 px-3.5 text-xs font-bold rounded-xl shrink-0 ${
                              isEmergency ? 'shadow-lg shadow-rose-500/30 animate-pulse' : ''
                            }`}
                          >
                            {isEmergency ? '🚨 EMERGENCY ACTIVE' : 'Mark as Emergency'}
                          </Button>
                        </div>
                      </div>

                      {/* Big Submit Button */}
                      <div className="pt-2">
                        <Button
                          type="submit"
                          disabled={quickWalkinMutation.isPending || !selectedDoctorId || mobile.length < 10}
                          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold h-12 text-sm rounded-2xl shadow-lg shadow-teal-600/20 gap-2 transition-all"
                        >
                          {quickWalkinMutation.isPending ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Allocating Live Token...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              Generate Token & Print Slip (Enter)
                              <ArrowRight className="w-4 h-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: 📅 ADVANCE SCHEDULED APPOINTMENT (Multi-Step Wizard) */}
        {/* ================================================================= */}
        <TabsContent value="advance" className="space-y-6 pt-1 focus-visible:outline-none">
          <Card className="max-w-3xl mx-auto border shadow-sm rounded-3xl bg-card/90 backdrop-blur-sm overflow-hidden">
            {/* Step Wizard Indicator Bar */}
            <div className="border-b bg-muted/40 p-4">
              <div className="flex items-center justify-between max-w-lg mx-auto relative">
                {/* Connecting Line */}
                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-0" />
                
                {[
                  { num: 1, label: 'Patient' },
                  { num: 2, label: 'Doctor & Date' },
                  { num: 3, label: 'Slot' },
                  { num: 4, label: 'Confirm' }
                ].map((s) => (
                  <div key={s.num} className="flex flex-col items-center gap-1 relative z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                        step === s.num
                          ? 'bg-teal-600 text-white ring-4 ring-teal-600/20 shadow-md'
                          : step > s.num
                          ? 'bg-emerald-600 text-white'
                          : 'bg-muted text-muted-foreground border'
                      }`}
                    >
                      {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                    </div>
                    <span className={`text-[10px] font-semibold ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <CardContent className="p-6">
              <form onSubmit={form.handleSubmit(onAdvanceSubmit)}>
                <AnimatePresence mode="wait">
                  {/* STEP 1: PATIENT SELECTION */}
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div>
                        <h3 className="font-bold text-base text-foreground">Step 1: Select or Search Patient</h3>
                        <p className="text-xs text-muted-foreground">Find existing registered patient records or enter ID</p>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search patient by mobile, name, or MRN code..."
                          className="pl-9 h-10 text-xs rounded-xl"
                          value={advancePatientSearch}
                          onChange={(e) => setAdvancePatientSearch(e.target.value)}
                          autoFocus
                        />
                      </div>

                      <div className="max-h-56 overflow-y-auto border rounded-2xl divide-y bg-muted/10">
                        {advancePatients?.map((p: any) => {
                          const isSel = advSelectedPatientId === p.id;
                          return (
                            <div
                              key={p.id}
                              onClick={() => form.setValue('patientId', p.id)}
                              className={`p-3.5 cursor-pointer hover:bg-muted/50 text-xs flex justify-between items-center transition-all ${
                                isSel ? 'bg-teal-50 dark:bg-teal-950/60 font-bold border-l-4 border-teal-600' : ''
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-bold text-foreground text-sm">
                                  {p.fullName || `${p.firstName || ''} ${p.lastName || ''}`}
                                </div>
                                <div className="text-[11px] text-muted-foreground font-mono flex gap-2">
                                  <span>{p.patientCode}</span>
                                  <span>•</span>
                                  <span>{p.mobile}</span>
                                  {p.gender && (
                                    <>
                                      <span>•</span>
                                      <span>{p.gender}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {isSel && (
                                <div className="w-6 h-6 rounded-full bg-teal-600 text-white flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {(!advancePatients || advancePatients.length === 0) && (
                          <div className="p-8 text-center text-xs text-muted-foreground">
                            {advancePatientSearch ? 'No matching patients found.' : 'Type name or phone above to search patients.'}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/reception/patients')}
                          className="text-xs text-teal-600"
                        >
                          + Register New Patient First
                        </Button>

                        <Button
                          type="button"
                          disabled={!advSelectedPatientId}
                          onClick={() => setStep(2)}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-4 rounded-xl gap-1.5"
                        >
                          Next: Doctor & Date <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: DOCTOR & DATE */}
                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5 text-xs"
                    >
                      <div>
                        <h3 className="font-bold text-base text-foreground">Step 2: Choose Specialist & Schedule Date</h3>
                        <p className="text-xs text-muted-foreground">Select consulting doctor, department, and appointment date</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="font-semibold">Consulting Doctor *</Label>
                          <Select
                            onValueChange={(val) => form.setValue('doctorId', val)}
                            defaultValue={advSelectedDoctorId}
                          >
                            <SelectTrigger className="h-10 text-xs rounded-xl font-medium">
                              <SelectValue placeholder="Choose Doctor" />
                            </SelectTrigger>
                            <SelectContent>
                              {doctors.map((d: any) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {formatDoctorName(getDoctorDisplayName(d))} ({d.department}) — Series {d.tokenPrefix || d.token_prefix || 'A'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="font-semibold">Appointment Date *</Label>
                          <Input
                            type="date"
                            min={format(new Date(), 'yyyy-MM-dd')}
                            className="h-10 text-xs rounded-xl font-mono"
                            {...form.register('appointmentDate')}
                          />
                        </div>
                      </div>

                      {/* Visit Type Radio Group */}
                      <div className="space-y-2 pt-2">
                        <Label className="font-semibold">Consultation Nature</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: 'NEW', label: 'New Visit', desc: 'First time consult' },
                            { id: 'FOLLOW_UP', label: 'Follow-Up', desc: 'Existing case review' },
                            { id: 'REPORT_REVIEW', label: 'Lab Review', desc: 'Discuss test findings' }
                          ].map((v) => (
                            <div
                              key={v.id}
                              onClick={() => form.setValue('visitType', v.id as any)}
                              className={`p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                                advSelectedVisitType === v.id
                                  ? 'border-teal-600 bg-teal-500/10 text-teal-800 dark:text-teal-200'
                                  : 'border-border/60 hover:border-border bg-card'
                              }`}
                            >
                              <div className="font-bold text-xs">{v.label}</div>
                              <div className="text-[10px] text-muted-foreground">{v.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep(1)}
                          className="text-xs h-9 rounded-xl"
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          disabled={!advSelectedDoctorId || !advSelectedDate}
                          onClick={() => setStep(3)}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-4 rounded-xl gap-1.5"
                        >
                          Next: Select Time Slot <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: TIME SLOTS */}
                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-5 text-xs"
                    >
                      <div>
                        <h3 className="font-bold text-base text-foreground">Step 3: Available Time Slots</h3>
                        <p className="text-xs text-muted-foreground">
                          Showing slots for {advSelectedDate} with {advSelectedDoctor ? formatDoctorName(getDoctorDisplayName(advSelectedDoctor)) : 'Doctor'}
                        </p>
                      </div>

                      {loadingSlots ? (
                        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                          Fetching doctor real-time slot calendar...
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto pr-1">
                          {availableSlotsList.map((slot) => {
                            const isSel = advSelectedTime === slot.time;
                            return (
                              <button
                                key={slot.time}
                                type="button"
                                disabled={!slot.isAvailable}
                                onClick={() => form.setValue('appointmentTime', slot.time)}
                                className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all ${
                                  isSel
                                    ? 'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-600/20'
                                    : slot.isAvailable
                                    ? 'bg-card hover:bg-teal-50 dark:hover:bg-teal-950/40 text-foreground border-border/80'
                                    : 'bg-muted/40 text-muted-foreground/50 border-border/40 cursor-not-allowed line-through'
                                }`}
                              >
                                {slot.time}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Booking Summary Box */}
                      {advSelectedTime && (
                        <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="font-bold text-teal-800 dark:text-teal-300 text-xs">
                              Selected Slot: {advSelectedDate} at {advSelectedTime}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Fee: ₹{advSelectedDoctor?.consultationFee || 500}
                            </div>
                          </div>
                          <CheckCircle2 className="w-5 h-5 text-teal-600" />
                        </div>
                      )}

                      <div className="flex justify-between pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep(2)}
                          className="text-xs h-9 rounded-xl"
                        >
                          Back
                        </Button>
                        <Button
                          type="submit"
                          disabled={!advSelectedTime || isCreatingAdvance}
                          className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs h-10 px-5 rounded-xl font-bold shadow-md"
                        >
                          {isCreatingAdvance ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                              Scheduling...
                            </>
                          ) : (
                            'Confirm & Lock Appointment'
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 4: CELEBRATION / SUCCESS */}
                  {step === 4 && (
                    <motion.div
                      key="step4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-6 text-center space-y-4"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                        <CheckCheck className="w-8 h-8" />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-xl font-black text-foreground">
                          Appointment Successfully Booked!
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          The patient schedule has been reserved and synchronized across hospital displays.
                        </p>
                      </div>

                      {bookingResult && (
                        <div className="max-w-sm mx-auto p-4 rounded-2xl bg-muted/30 border border-border/80 text-left text-xs space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Token Code:</span>
                            <span className="font-mono font-bold text-teal-600 text-sm">
                              {bookingResult.tokenNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Date & Slot:</span>
                            <span className="font-semibold">{bookingResult.appointmentDate} at {bookingResult.appointmentTime}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-center gap-3 pt-3">
                        <Button
                          type="button"
                          onClick={() => {
                            setStep(1);
                            form.reset();
                          }}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 px-4 rounded-xl"
                        >
                          Book Another Appointment
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate('/reception/queue')}
                          className="text-xs h-9 rounded-xl"
                        >
                          Go to Live Queue
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default function AppointmentBooking() {
  return (
    <ErrorBoundary>
      <AppointmentBookingContent />
    </ErrorBoundary>
  );
}
