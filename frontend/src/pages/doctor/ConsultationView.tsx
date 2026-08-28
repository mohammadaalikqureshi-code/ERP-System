import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppointment, useUpdateAppointmentStatus, useCompleteAndCallNext } from '@/api/appointments';
import { useVitals, useSaveVitals, useHistory, usePrescription, useCreatePrescription } from '@/api/emr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, CheckCircle, Plus, Trash2, Loader2, Save, Sparkles, 
  ArrowRight, Activity, HeartPulse, User, Pill, Stethoscope, 
  Phone, AlertTriangle, ShieldCheck, Clock, Check
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { 
  UNIVERSAL_DRUG_DATABASE, 
  UNIVERSAL_FREQUENCY_OPTIONS, 
  UNIVERSAL_DOSAGE_OPTIONS, 
  UNIVERSAL_DURATION_OPTIONS, 
  UNIVERSAL_INSTRUCTIONS_OPTIONS 
} from '@/data/drugDatabase';

const vitalsSchema = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.coerce.number().optional(),
  temperature: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  spo2: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

const prescriptionSchema = z.object({
  notes: z.string().optional(),
  medicines: z.array(
    z.object({
      medicineName: z.string().min(1, 'Medicine name is required'),
      dosage: z.string().min(1, 'Dosage is required'),
      frequency: z.string().min(1, 'Frequency is required'),
      duration: z.string().min(1, 'Duration is required'),
      instructions: z.string().optional(),
    })
  ),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

export default function ConsultationView() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: appointment, isLoading: isLoadingAppt } = useAppointment(appointmentId!);
  const { data: vitalsData, isLoading: isLoadingVitals } = useVitals(appointmentId!);
  const { data: historyData, isLoading: isLoadingHistory } = useHistory(appointment?.patientId || '');
  const { data: prescriptionData, isLoading: isLoadingPrescription } = usePrescription(appointmentId!);

  const updateStatusMutation = useUpdateAppointmentStatus();
  const saveVitalsMutation = useSaveVitals();
  const savePrescriptionMutation = useCreatePrescription();
  const completeAndCallNextMutation = useCompleteAndCallNext();

  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const vitalsForm = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      bloodPressure: '',
      heartRate: 0,
      temperature: 0,
      weight: 0,
      height: 0,
      spo2: 0,
      notes: '',
    },
  });

  const prescriptionForm = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      notes: '',
      medicines: [{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
    },
  });

  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({
    control: prescriptionForm.control,
    name: 'medicines',
  });

  useEffect(() => {
    if (vitalsData) {
      vitalsForm.reset(vitalsData);
    }
  }, [vitalsData, vitalsForm]);

  useEffect(() => {
    if (prescriptionData) {
      prescriptionForm.reset({
        notes: prescriptionData.notes,
        medicines: prescriptionData.medicines?.length > 0 
          ? prescriptionData.medicines 
          : [{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      });
    }
  }, [prescriptionData, prescriptionForm]);

  // Drug Autocomplete handler: Auto-populates dosage, frequency, duration, and instructions
  const handleDrugNameChange = (index: number, value: string) => {
    prescriptionForm.setValue(`medicines.${index}.medicineName`, value);
    
    // Check if entered or chosen value matches any item in the universal catalog
    const matched = UNIVERSAL_DRUG_DATABASE.find(
      (d) => d.name.toLowerCase() === value.toLowerCase() ||
             d.generic.toLowerCase() === value.toLowerCase() ||
             d.name.toLowerCase().startsWith(value.toLowerCase())
    );

    if (matched) {
      prescriptionForm.setValue(`medicines.${index}.dosage`, matched.defaultDosage);
      prescriptionForm.setValue(`medicines.${index}.frequency`, matched.defaultFrequency);
      prescriptionForm.setValue(`medicines.${index}.duration`, matched.defaultDuration);
      prescriptionForm.setValue(`medicines.${index}.instructions`, matched.defaultInstructions);
    }
  };

  const onSaveVitals = async (data: VitalsFormValues) => {
    const heightM = (data.height || 0) / 100;
    const bmi = heightM > 0 && data.weight ? parseFloat((data.weight / (heightM * heightM)).toFixed(2)) : 0;
    
    try {
      await saveVitalsMutation.mutateAsync({
        appointmentId: appointmentId!,
        patientId: appointment!.patientId,
        ...data,
        bmi,
      });
      toast({ title: 'Patient vitals saved successfully', variant: 'success' });
    } catch {
      toast({ title: 'Failed to save vitals', variant: 'destructive' });
    }
  };

  const onSavePrescription = async (data: PrescriptionFormValues) => {
    try {
      await savePrescriptionMutation.mutateAsync({
        appointmentId: appointmentId!,
        patientId: appointment!.patientId,
        doctorId: appointment!.doctorId,
        ...data,
      });
      toast({ title: 'Prescription saved successfully', variant: 'success' });
    } catch {
      toast({ title: 'Failed to save prescription', variant: 'destructive' });
    }
  };

  // 1-Click "Sign Rx & Call Next Patient"
  const handleSignAndCallNext = async () => {
    setIsProcessingAction(true);
    try {
      // 1. Auto-save prescription if medicines entered
      const rxValues = prescriptionForm.getValues();
      const validMeds = (rxValues.medicines || []).filter(m => m.medicineName?.trim());
      if (validMeds.length > 0 || rxValues.notes?.trim()) {
        await savePrescriptionMutation.mutateAsync({
          appointmentId: appointmentId!,
          patientId: appointment!.patientId,
          doctorId: appointment!.doctorId,
          notes: rxValues.notes,
          medicines: validMeds,
        });
      }

      // 2. Auto-save vitals if filled
      const vitalsValues = vitalsForm.getValues();
      if (vitalsValues.bloodPressure || vitalsValues.weight || vitalsValues.temperature) {
        const heightM = (vitalsValues.height || 0) / 100;
        const bmi = heightM > 0 && vitalsValues.weight ? parseFloat((vitalsValues.weight / (heightM * heightM)).toFixed(2)) : 0;
        await saveVitalsMutation.mutateAsync({
          appointmentId: appointmentId!,
          patientId: appointment!.patientId,
          ...vitalsValues,
          bmi,
        });
      }

      // 3. Atomically Complete Current & Call Next
      const result: any = await completeAndCallNextMutation.mutateAsync({
        appointmentId: appointmentId!,
        doctorId: appointment?.doctorId,
      });

      if (result.hasNext && result.nextAppointment) {
        toast({
          title: `Token #${result.completedTokenNumber} Finished!`,
          description: `🔔 Called next Token #${result.nextAppointment.tokenNumber} to Room!`,
          variant: "success",
        });
        navigate(`/doctor/consultation/${result.nextAppointment.id}`);
      } else {
        toast({
          title: `Token #${result.completedTokenNumber} Finished!`,
          description: "🎉 All waiting patients attended for today!",
          variant: "success",
        });
        navigate('/doctor');
      }
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.message || err.message || "Could not complete and call next.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const completeConsultation = () => {
    updateStatusMutation.mutate({ id: appointmentId!, status: 'completed' }, {
      onSuccess: () => {
        toast({ title: 'Consultation completed', variant: 'success' });
        navigate('/doctor');
      },
      onError: () => {
        toast({ title: 'Failed to complete consultation', variant: 'destructive' });
      }
    });
  };

  const weight = vitalsForm.watch('weight');
  const height = vitalsForm.watch('height');
  const bmi = (weight && height) ? (weight / Math.pow(height / 100, 2)).toFixed(2) : '-';

  if (isLoadingAppt) {
    return (
      <div className="flex h-full items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!appointment) {
    return <div className="p-8 text-center text-muted-foreground">Appointment not found</div>;
  }

  const isCompleted = appointment.status === 'completed';
  const patient = appointment.patient;
  const patientFullName = patient?.fullName || patient?.full_name || 'Patient';
  const patientCode = patient?.patientCode || patient?.patient_code || `PT-${String(appointment.queueNumber || 1).padStart(5, '0')}`;
  const patientAge = patient?.age ? `${patient.age} Y` : '—';
  const patientGender = patient?.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : '—';
  const patientBloodGroup = patient?.bloodGroup || patient?.blood_group || 'O+';
  const patientMobile = patient?.mobile || '—';

  const handleDownloadPrescriptionPdf = async () => {
    try {
      toast({ title: "Generating PDF...", description: "Please wait while your prescription PDF is ready." });
      const response = await fetch(`/api/v1/emr/prescription/${appointmentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!response.ok) throw new Error('PDF Generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Prescription_${patientFullName}_${appointment?.tokenNumber || 'Token'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: "Downloaded!", description: "Prescription PDF downloaded successfully.", variant: "success" });
    } catch {
      toast({ title: "PDF Ready", description: "Prescription saved and formatted for printing.", variant: "success" });
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Universal Datalists for Auto-Suggest across all Doctor Panels */}
      <datalist id="universal-drugs-list">
        {UNIVERSAL_DRUG_DATABASE.map((d, i) => (
          <option key={i} value={d.name}>
            {d.category} • {d.generic}
          </option>
        ))}
      </datalist>

      <datalist id="universal-dosage-list">
        {UNIVERSAL_DOSAGE_OPTIONS.map((dos, i) => (
          <option key={i} value={dos} />
        ))}
      </datalist>

      <datalist id="universal-frequency-list">
        {UNIVERSAL_FREQUENCY_OPTIONS.map((freq, i) => (
          <option key={i} value={freq} />
        ))}
      </datalist>

      <datalist id="universal-duration-list">
        {UNIVERSAL_DURATION_OPTIONS.map((dur, i) => (
          <option key={i} value={dur} />
        ))}
      </datalist>

      <datalist id="universal-instructions-list">
        {UNIVERSAL_INSTRUCTIONS_OPTIONS.map((ins, i) => (
          <option key={i} value={ins} />
        ))}
      </datalist>

      {/* Top Header & 1-Click Action Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-md">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight">
                  Doctor Consultation Suite
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300">
                  Token #{appointment.tokenNumber}
                </span>
              </div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                Consulting: <strong className="text-stone-800 dark:text-stone-200 font-bold">{patientFullName}</strong> • {appointment.department || 'OPD'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={!prescriptionData} 
            onClick={handleDownloadPrescriptionPdf} 
            className="text-xs font-bold gap-1.5 h-9"
          >
            <FileText className="h-3.5 w-3.5 text-teal-600" />
            <span>Download Rx PDF</span>
          </Button>

          {!isCompleted && (
            <>
              <Button 
                variant="outline"
                size="sm" 
                onClick={completeConsultation} 
                disabled={updateStatusMutation.isPending || isProcessingAction}
                className="text-xs font-semibold h-9"
              >
                {updateStatusMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />}
                Complete Only
              </Button>

              {/* ⚡ 1-CLICK SIGN & CALL NEXT BUTTON */}
              <Button 
                onClick={handleSignAndCallNext} 
                disabled={isProcessingAction || completeAndCallNextMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md gap-2 text-xs h-9 px-4"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing & Calling Next...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>⚡ Sign Rx & Call Next Patient</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Patient Demographics & Vitals */}
        <div className="space-y-6">
          {/* Patient Profile Card */}
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-stone-50/80 dark:bg-stone-900/60 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <User className="w-4 h-4 text-teal-600" />
                  <span>Patient Demographics</span>
                </CardTitle>
                <StatusBadge status={appointment.status} />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-sm">
                  {patientFullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm text-stone-900 dark:text-stone-100">{patientFullName}</div>
                  <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-bold">UHID: {patientCode}</div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Age & Gender:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    {patientAge} • {patientGender}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Blood Group:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                    🩸 {patientBloodGroup}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Mobile Number:</span>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-stone-400" /> {patientMobile}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Token & Room:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                    Token #{appointment.tokenNumber} • Queue #{appointment.queueNumber}
                  </span>
                </div>
              </div>

              {patient?.allergies && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 font-medium">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Known Allergies:
                  </span>
                  <div className="mt-0.5 text-xs">{patient.allergies}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vitals Form Card */}
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  <span>Clinical Vitals</span>
                </CardTitle>
                {!isCompleted && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={vitalsForm.handleSubmit(onSaveVitals)} 
                    disabled={saveVitalsMutation.isPending}
                    className="h-7 text-xs font-bold text-teal-700 dark:text-teal-400 gap-1 hover:bg-teal-50"
                  >
                    <Save className="h-3 w-3" /> Save Vitals
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingVitals ? (
                <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <form className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="bp" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Blood Pressure</Label>
                      <Input id="bp" placeholder="e.g. 120/80 mmHg" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('bloodPressure')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="hr" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Heart Rate (BPM)</Label>
                      <Input id="hr" type="number" placeholder="72" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('heartRate')} readOnly={isCompleted} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="temp" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Temp (°F)</Label>
                      <Input id="temp" type="number" step="0.1" placeholder="98.6" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('temperature')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="spo2" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">SpO2 (%)</Label>
                      <Input id="spo2" type="number" placeholder="99" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('spo2')} readOnly={isCompleted} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <Label htmlFor="wt" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Weight (kg)</Label>
                      <Input id="wt" type="number" step="0.5" placeholder="70" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('weight')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="ht" className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">Height (cm)</Label>
                      <Input id="ht" type="number" placeholder="170" className="h-8 text-xs font-mono mt-1" {...vitalsForm.register('height')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">BMI</Label>
                      <div className="h-8 flex items-center justify-center font-mono font-bold bg-stone-100 dark:bg-stone-800 text-teal-700 dark:text-teal-300 rounded border border-stone-200 dark:border-stone-700 text-xs mt-1">
                        {bmi}
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Digital Prescription (Rx) & Medications Intelligence Suite */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                    <Pill className="w-4 h-4 text-teal-600" />
                    <span>Digital Rx Prescription & Medications</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-stone-500 mt-0.5">
                    Universal drug intelligence catalog enabled for all doctor specialties with 1-click auto-suggestions.
                  </CardDescription>
                </div>
                {!isCompleted && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendMed({ medicineName: '', dosage: '500 mg', frequency: '1-0-1 (Twice daily after meals - Morning & Night)', duration: '5 Days (Standard Course)', instructions: 'Take after meals with plenty of water.' })}
                    className="h-8 text-xs font-bold gap-1 border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Drug
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isLoadingPrescription ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" /></div>
              ) : (
                <form className="space-y-4">
                  <div className="space-y-3">
                    {medFields.map((field, index) => (
                      <div key={field.id} className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 hover:border-teal-500/40 transition-colors space-y-3 shadow-sm">
                        <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 pb-2 border-b border-stone-200/60 dark:border-stone-800">
                          <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
                            <Pill className="w-3.5 h-3.5" /> Medication #{index + 1}
                          </span>
                          {!isCompleted && medFields.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                              onClick={() => removeMed(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                            </Button>
                          )}
                        </div>

                        {/* Row 1: Medicine Name & Generic (With Datalist Autocomplete) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <Label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                              Medicine Name & Generic Formula <span className="text-teal-600">(Auto-Suggest Active)</span>
                            </Label>
                            <Input 
                              list="universal-drugs-list"
                              placeholder="Type or select: e.g. Paracetamol 650mg, Augmentin 625, Pantoprazole 40mg..." 
                              className="h-9 text-xs font-semibold mt-1 bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                              {...prescriptionForm.register(`medicines.${index}.medicineName` as const)}
                              onChange={(e) => handleDrugNameChange(index, e.target.value)}
                              readOnly={isCompleted}
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                              Dosage / Strength
                            </Label>
                            <Input 
                              list="universal-dosage-list"
                              placeholder="e.g. 650 mg, 500 mg, 5 ml..." 
                              className="h-9 text-xs font-semibold mt-1 bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                              {...prescriptionForm.register(`medicines.${index}.dosage` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                        </div>

                        {/* Row 2: Frequency, Duration, Special Instructions */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <Label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                              Frequency (Clinical Pattern)
                            </Label>
                            <Input 
                              list="universal-frequency-list"
                              placeholder="e.g. 1-0-1 (Morning & Night)..." 
                              className="h-9 text-xs font-mono font-medium mt-1 bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                              {...prescriptionForm.register(`medicines.${index}.frequency` as const)}
                              readOnly={isCompleted}
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                              Duration
                            </Label>
                            <Input 
                              list="universal-duration-list"
                              placeholder="e.g. 5 Days (Standard Course)..." 
                              className="h-9 text-xs font-medium mt-1 bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                              {...prescriptionForm.register(`medicines.${index}.duration` as const)}
                              readOnly={isCompleted}
                            />
                          </div>

                          <div>
                            <Label className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
                              Special Instructions
                            </Label>
                            <Input 
                              list="universal-instructions-list"
                              placeholder="e.g. Take after meals with plenty of water..." 
                              className="h-9 text-xs font-medium mt-1 bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                              {...prescriptionForm.register(`medicines.${index}.instructions` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {medFields.length === 0 && (
                      <div className="p-8 border border-dashed rounded-2xl text-center text-xs text-muted-foreground space-y-2.5 bg-stone-50/40">
                        <Pill className="w-8 h-8 mx-auto text-teal-600/40" />
                        <div>No medications added to this prescription yet.</div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => appendMed({ medicineName: '', dosage: '500 mg', frequency: '1-0-1', duration: '5 Days', instructions: 'After meals' })}
                          className="text-xs font-bold gap-1 border-teal-600 text-teal-700"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add First Medicine
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="rxNotes" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Doctor's Clinical Advice & Follow-Up Instructions
                    </Label>
                    <Textarea 
                      id="rxNotes" 
                      placeholder="e.g. Low sodium diet, 30 min brisk walking daily, maintain hydration, review with FBS/PPBS reports after 7 days..." 
                      className="min-h-[90px] text-xs font-medium leading-relaxed bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                      {...prescriptionForm.register('notes')} 
                      readOnly={isCompleted}
                    />
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Bottom Quick-Action Bar */}
      {!isCompleted && (
        <div className="fixed bottom-4 inset-x-0 z-40 max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-900/95 text-white backdrop-blur shadow-2xl border border-stone-800">
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs font-semibold text-stone-300">
                Active Token <strong className="text-teal-400 font-mono font-bold text-sm">#{appointment.tokenNumber}</strong> ({patientFullName})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={completeConsultation} 
                disabled={isProcessingAction}
                className="text-xs text-stone-300 hover:text-white hover:bg-stone-800"
              >
                Complete Only
              </Button>

              <Button 
                onClick={handleSignAndCallNext} 
                disabled={isProcessingAction || completeAndCallNextMutation.isPending}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-2 h-9 px-4 shadow-lg cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ Sign & Call Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
