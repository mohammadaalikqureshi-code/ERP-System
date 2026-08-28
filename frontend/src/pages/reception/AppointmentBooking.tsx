import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
  QrCode
} from 'lucide-react';
import { Patient, Doctor } from '@/types';

type BookingFormValues = z.infer<typeof appointmentCreateSchema>;

export const getDoctorDisplayName = (doc: any): string => {
  if (!doc) return 'Doctor';
  const raw =
    doc.user?.fullName ||
    doc.user?.full_name ||
    doc.fullName ||
    doc.full_name ||
    (doc.firstName && doc.firstName !== 'Doctor' ? `${doc.firstName} ${doc.lastName || ''}`.trim() : '') ||
    (doc.user ? `${doc.user.firstName || doc.user.first_name || ''} ${doc.user.lastName || doc.user.last_name || ''}`.trim() : '') ||
    (doc.department ? `${doc.department} Specialist` : 'Doctor');
  return raw.replace(/^Dr\.?\s*/i, '').trim() || 'Doctor';
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
          description: `Patient already in queue for Dr. ${res.doctor?.fullName || 'Doctor'} today. Duplicate token creation blocked.`,
          variant: "warning",
        });
      } else {
        toast({
          title: `🎟️ Token #${res.tokenNumber || res.token_number} Generated!`,
          description: `Added to Dr. ${res.doctor?.fullName || 'Doctor'}'s live queue (${res.queueStats?.estimatedWaitFormatted || ''}).`,
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
            <div class="row"><span>Doctor:</span> <span>Dr. ${doctorName}</span></div>
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
  const advSelectedPatient = advancePatients?.find((p: any) => p.id === advSelectedPatientId);
  const { data: slots } = useAvailableSlots(advSelectedDoctorId, advSelectedDate);

  const onAdvanceSubmit = async (data: BookingFormValues) => {
    try {
      const result = await createAppointment(data);
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Front Desk Token & Appointment Desk"
          description="High-speed walk-in token generation, real-time queue assignment, and advance bookings."
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reception/queue')}
            className="text-xs gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-teal-600" />
            Live Queue Monitor
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/80 p-1">
          <TabsTrigger value="express" className="gap-2 text-xs font-bold py-2">
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            ⚡ Express Walk-in Token (5s)
          </TabsTrigger>
          <TabsTrigger value="advance" className="gap-2 text-xs font-bold py-2">
            <Calendar className="w-4 h-4 text-blue-500" />
            📅 Advance Slot Booking
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* TAB 1: ⚡ EXPRESS WALK-IN TOKEN (THE #1 BEST WAY) */}
        {/* ================================================================= */}
        <TabsContent value="express" className="space-y-6 pt-4">
          {generatedSlip ? (
            /* PRINTABLE THERMAL TOKEN SLIP CARD */
            <div className="max-w-md mx-auto space-y-4 animate-in zoom-in-95">
              <Card className="border-2 border-teal-600/60 shadow-2xl bg-card overflow-hidden">
                <div className={`p-4 text-white text-center space-y-1 ${
                  (generatedSlip.isEmergency || generatedSlip.is_emergency) ? 'bg-red-600' : 'bg-teal-600'
                }`}>
                  <div className="text-xs uppercase tracking-widest font-bold opacity-90">Sanjeevani Multi-Specialty Hospital</div>
                  <div className="text-sm font-semibold">
                    {(generatedSlip.isEmergency || generatedSlip.is_emergency) ? '🚨 CRITICAL EMERGENCY TOKEN' : 'OPD Patient Token Receipt'}
                  </div>
                  {(generatedSlip.isEmergency || generatedSlip.is_emergency) && (
                    <div className="mt-2 py-1 px-2.5 rounded-lg bg-black/40 text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Priority 1: Continuous Voice Calling Active on TV Board
                    </div>
                  )}
                  {(generatedSlip.isDuplicatePrevented || generatedSlip.is_duplicate_prevented) && (
                    <div className="mt-2 py-1 px-2.5 rounded-lg bg-amber-400 text-stone-950 font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Patient Already Holds Active Token (Duplicate Creation Blocked)
                    </div>
                  )}
                </div>

                <CardContent className="p-6 text-center space-y-4">
                  <div className="py-2 border-b">
                    <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Your Token Number</div>
                    <div className="text-6xl font-black font-mono text-teal-600 tracking-tight my-1">
                      {generatedSlip.tokenNumber}
                    </div>
                    <div className="inline-block px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-semibold text-xs border border-teal-200">
                      {generatedSlip.queueStats.estimatedWaitFormatted}
                    </div>
                  </div>

                  <div className="text-left text-xs space-y-2 py-2 border-b">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Patient:</span>
                      <span className="font-bold">{generatedSlip.patient.fullName} ({generatedSlip.patient.patientCode})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Doctor:</span>
                      <span className="font-bold text-foreground">Dr. {generatedSlip.doctor.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department & Room:</span>
                      <span className="font-semibold">{generatedSlip.doctor.department} • {generatedSlip.doctor.room}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Consultation Fee:</span>
                      <span className="font-mono font-bold text-emerald-600">₹{generatedSlip.doctor.consultationFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date & Time:</span>
                      <span>{generatedSlip.appointmentDate} • {generatedSlip.appointmentTime}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl text-[11px] text-muted-foreground space-y-1">
                    <div>Please proceed to the <strong>OPD Waiting Lounge</strong>.</div>
                    <div>Your token will be announced automatically on the TV screen.</div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handlePrintSlip} className="flex-1 bg-stone-900 text-white gap-2 text-xs h-9">
                      <Printer className="w-3.5 h-3.5" /> Print Token Slip
                    </Button>
                    <Button onClick={handleResetExpress} variant="outline" className="flex-1 gap-2 text-xs h-9">
                      <RefreshCw className="w-3.5 h-3.5" /> Next Patient (ESC)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            /* EXPRESS GENERATOR FORM */
            <form onSubmit={handleQuickTokenSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT: Patient Mobile & Quick Info */}
              <Card className="lg:col-span-1 border shadow-sm h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-teal-600" />
                    1. Patient Details
                  </CardTitle>
                  <CardDescription className="text-xs">Type mobile to auto-fill returning records</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Mobile Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="mobile" className="font-semibold flex items-center justify-between">
                      <span>Mobile Number (10 Digits) *</span>
                      {isSearchingMobile && <span className="text-[10px] text-muted-foreground animate-pulse">Checking...</span>}
                    </Label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
                      <Input
                        id="mobile"
                        type="tel"
                        placeholder="e.g. 9876543210"
                        className="pl-9 font-mono text-sm h-9"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        maxLength={10}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Returning Patient Found Banner */}
                  {existingPatient && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Returning Patient Verified!
                      </div>
                      <div className="font-semibold">{existingPatient.fullName} ({existingPatient.patientCode})</div>
                      <div className="text-[11px] opacity-80">{existingPatient.age || 42} Y • {existingPatient.gender} • Blood: {existingPatient.bloodGroup || 'O+'}</div>
                    </div>
                  )}

                  {/* Patient Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="e.g. Rajesh Kumar Verma"
                      className="h-8 text-xs"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Age & Gender */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="age">Age (Years)</Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="35"
                        className="h-8 text-xs font-mono"
                        value={age}
                        onChange={(e) => setAge(e.target.value ? Number(e.target.value) : '')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="h-8 text-xs">
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

                  {/* Blood Group */}
                  <div className="space-y-1">
                    <Label htmlFor="blood">Blood Group</Label>
                    <Select value={bloodGroup} onValueChange={setBloodGroup}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* RIGHT: Doctor & Priority Selector */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                        2. Select Consulting Doctor & Department
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">{doctors.length} Doctors on Duty</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingDoctors ? (
                      <div className="p-8 text-center text-xs text-muted-foreground">Loading active doctors...</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {doctors.map((doc: any) => {
                          const isSelected = selectedDoctorId === doc.id;
                          const name = getDoctorDisplayName(doc);
                          const fee = doc.consultationFee || 500;
                          const dept = doc.department || 'General OPD';

                          return (
                            <div
                              key={doc.id}
                              onClick={() => setSelectedDoctorId(doc.id)}
                              className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-teal-600 bg-teal-50/50 dark:bg-teal-950/30 shadow-md ring-2 ring-teal-600/20'
                                  : 'border-muted hover:border-muted-foreground/30 bg-card'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-bold text-sm text-foreground">Dr. {name}</div>
                                  <div className="text-xs font-semibold text-teal-700 dark:text-teal-400">{dept}</div>
                                  <div className="text-[11px] text-muted-foreground">{doc.specialization || 'Consultant'}</div>
                                </div>
                                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-muted text-foreground">
                                  ₹{fee}
                                </span>
                              </div>

                              <div className="mt-3 pt-2 border-t border-muted/80 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>Cabin 101</span>
                                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                  Available Now
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Priority & Emergency Check */}
                    <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border bg-muted/20">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${isEmergency ? 'text-rose-600' : 'text-amber-500'}`} />
                          Emergency / Critical Case?
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Jumps patient to Token #1 ahead of regular queue with immediate doctor notification.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isEmergency ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => setIsEmergency(!isEmergency)}
                        className="text-xs h-8 shrink-0 font-bold"
                      >
                        {isEmergency ? '🚨 EMERGENCY ACTIVE' : 'Mark as Emergency'}
                      </Button>
                    </div>

                    {/* Submit Bar */}
                    <div className="pt-2 flex items-center gap-3">
                      <Button
                        type="submit"
                        disabled={quickWalkinMutation.isPending}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold h-11 text-sm shadow-lg gap-2"
                      >
                        {quickWalkinMutation.isPending ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Allocating Token in Live Queue...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            ⚡ Generate Live Token & Print Receipt (Enter)
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </form>
          )}
        </TabsContent>

        {/* ================================================================= */}
        {/* TAB 2: 📅 ADVANCE SCHEDULED APPOINTMENT (Multi-Step Form) */}
        {/* ================================================================= */}
        <TabsContent value="advance" className="space-y-6 pt-4">
          <Card className="max-w-3xl mx-auto border shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Advance Date & Slot Booking</CardTitle>
              <CardDescription className="text-xs">Schedule an appointment for a future date and time</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onAdvanceSubmit)} className="space-y-6">
                {step === 1 && (
                  <div className="space-y-4">
                    <Label>Step 1: Select Patient</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search patient by mobile or name..."
                        className="pl-9 h-9 text-xs"
                        value={advancePatientSearch}
                        onChange={(e) => setAdvancePatientSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-xl divide-y">
                      {advancePatients?.map((p: any) => (
                        <div
                          key={p.id}
                          onClick={() => form.setValue('patientId', p.id)}
                          className={`p-3 cursor-pointer hover:bg-muted/50 text-xs flex justify-between items-center ${
                            advSelectedPatientId === p.id ? 'bg-teal-50 dark:bg-teal-950 font-bold border-l-4 border-teal-600' : ''
                          }`}
                        >
                          <div>
                            <div className="font-semibold">{p.fullName || `${p.firstName || ''} ${p.lastName || ''}`}</div>
                            <div className="text-[11px] text-muted-foreground">{p.patientCode} • {p.mobile}</div>
                          </div>
                          {advSelectedPatientId === p.id && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" disabled={!advSelectedPatientId} onClick={() => setStep(2)} className="text-xs">
                        Next: Select Doctor & Date <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4 text-xs">
                    <Label>Step 2: Doctor & Date</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Doctor</Label>
                        <Select onValueChange={(val) => form.setValue('doctorId', val)} defaultValue={advSelectedDoctorId}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Select Doctor" />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors.map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>
                                Dr. {getDoctorDisplayName(d)} ({d.department})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Date</Label>
                        <Input type="date" className="h-9 text-xs" {...form.register('appointmentDate')} />
                      </div>
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={() => setStep(1)} className="text-xs">Back</Button>
                      <Button type="button" disabled={!advSelectedDoctorId} onClick={() => setStep(3)} className="text-xs">
                        Next: Pick Time Slot <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-4 text-xs">
                    <Label>Step 3: Available Time Slots</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '16:00', '16:30', '17:00'].map((slot) => (
                        <Button
                          key={slot}
                          type="button"
                          variant={form.watch('appointmentTime') === slot ? "default" : "outline"}
                          className="h-8 text-xs font-mono"
                          onClick={() => form.setValue('appointmentTime', slot)}
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>

                    <div className="flex justify-between pt-4">
                      <Button type="button" variant="outline" onClick={() => setStep(2)} className="text-xs">Back</Button>
                      <Button type="submit" disabled={!form.watch('appointmentTime') || isCreatingAdvance} className="bg-teal-600 text-white text-xs">
                        {isCreatingAdvance ? 'Scheduling...' : 'Confirm Booking'}
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="p-8 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                    <div className="text-base font-bold">Appointment Successfully Scheduled!</div>
                    <Button onClick={() => { setStep(1); form.reset(); }} className="text-xs">Book Another</Button>
                  </div>
                )}
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
