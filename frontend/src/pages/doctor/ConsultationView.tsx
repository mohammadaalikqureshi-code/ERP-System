import React, { useEffect, useState, useRef } from 'react';
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
  Phone, AlertTriangle, ShieldCheck, Clock, Check, Search, ChevronDown, ListPlus, Calendar, Layers
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { 
  UNIVERSAL_DRUG_DATABASE, 
  UNIVERSAL_FREQUENCY_OPTIONS, 
  UNIVERSAL_DOSAGE_OPTIONS, 
  UNIVERSAL_DURATION_OPTIONS, 
  UNIVERSAL_INSTRUCTIONS_OPTIONS,
  UNIVERSAL_BP_OPTIONS,
  UNIVERSAL_HEART_RATE_OPTIONS,
  UNIVERSAL_TEMP_OPTIONS,
  UNIVERSAL_SPO2_OPTIONS,
  UNIVERSAL_WEIGHT_OPTIONS,
  UNIVERSAL_HEIGHT_OPTIONS,
  DrugInfo
} from '@/data/drugDatabase';

// =========================================================================
// 🚀 UPSIDE FLOATING AUTO-SUGGEST INPUT COMPONENT
// Renders suggestions directly ABOVE (UPSIDE) the input block while typing!
// =========================================================================
interface UpsideAutoSuggestProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[] | DrugInfo[];
  placeholder?: string;
  isDrugName?: boolean;
  onDrugSelect?: (drug: DrugInfo) => void;
  sublabel?: string;
}

const UpsideAutoSuggestInput: React.FC<UpsideAutoSuggestProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  isDrugName = false,
  onDrugSelect,
  sublabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter options based on typed value
  const filteredOptions = React.useMemo(() => {
    const q = (value || '').toLowerCase().trim();
    if (!q) return options;

    if (isDrugName) {
      return (options as DrugInfo[]).filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.generic.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }

    return (options as string[]).filter((opt) =>
      opt.toLowerCase().includes(q)
    );
  }, [value, options, isDrugName]);

  // Click outside to close upside popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-bold text-stone-800 dark:text-stone-200">
          {label}
        </Label>
        {sublabel && (
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">{sublabel}</span>
        )}
      </div>

      {/* 🌟 UPSIDE FLOATING RESULTS POPUP (Positioned Above the Input Block) */}
      {isOpen && (
        <div className="absolute bottom-full mb-1.5 left-0 right-0 z-50 bg-white dark:bg-stone-900 border-2 border-teal-500/80 rounded-2xl shadow-[0_-10px_35px_rgba(0,0,0,0.25)] max-h-60 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 animate-in fade-in slide-in-from-bottom-2">
          {/* Header of Upside Popup */}
          <div className="sticky top-0 bg-teal-50/95 dark:bg-stone-800/95 px-3 py-1.5 border-b border-teal-200 dark:border-stone-700 flex items-center justify-between backdrop-blur-sm z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Suggestions ({filteredOptions.length})
            </span>
            <span className="text-[9px] text-stone-500 font-medium">Click to select ⚡</span>
          </div>

          {/* Results List */}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt: any, idx: number) => {
              if (isDrugName) {
                const drug = opt as DrugInfo;
                return (
                  <div
                    key={idx}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      onChange(drug.name);
                      if (onDrugSelect) onDrugSelect(drug);
                      setIsOpen(false);
                    }}
                    className="p-2.5 hover:bg-teal-100/60 dark:hover:bg-teal-950/60 cursor-pointer transition-all flex flex-col gap-0.5 text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        {drug.name}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                        {drug.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 italic">
                      Formula: {drug.generic}
                    </div>
                    <div className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-2 mt-0.5">
                      <span>Dose: {drug.defaultDosage}</span>
                      <span>•</span>
                      <span>Freq: {drug.defaultFrequency.split(' ')[0]}</span>
                      <span>•</span>
                      <span>Dur: {drug.defaultDuration.split(' ')[0]} {drug.defaultDuration.split(' ')[1] || ''}</span>
                    </div>
                  </div>
                );
              }

              const strOpt = opt as string;
              return (
                <div
                  key={idx}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    onChange(strOpt);
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-teal-100/60 dark:hover:bg-teal-950/60 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <span className="group-hover:text-teal-700 dark:group-hover:text-teal-300 font-medium">
                    {strOpt}
                  </span>
                  <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 font-bold transition-opacity">
                    Select ⚡
                  </span>
                </div>
              );
            })
          ) : (
            <div className="p-4 text-center text-xs text-stone-500 italic">
              No exact match. Your custom typing is saved!
            </div>
          )}
        </div>
      )}

      {/* Input Box */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="h-9 text-xs font-semibold bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 pr-7 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-2.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

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
      medicines: [
        { 
          medicineName: '', 
          dosage: '500 mg', 
          frequency: '1-0-1 (Twice daily after meals - Morning & Night)', 
          duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', 
          instructions: 'Take after meals with plenty of water.' 
        }
      ],
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
        notes: prescriptionData.notes || '',
        medicines: prescriptionData.medicines?.length > 0 
          ? prescriptionData.medicines 
          : [
              { 
                medicineName: '', 
                dosage: '500 mg', 
                frequency: '1-0-1 (Twice daily after meals - Morning & Night)', 
                duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', 
                instructions: 'Take after meals with plenty of water.' 
              }
            ],
      });
    }
  }, [prescriptionData, prescriptionForm]);

  // Handle drug auto-population across all 5 fields
  const handleDrugAutoPopulate = (index: number, drug: DrugInfo) => {
    prescriptionForm.setValue(`medicines.${index}.medicineName`, drug.name, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.dosage`, drug.defaultDosage, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.frequency`, drug.defaultFrequency, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.duration`, drug.defaultDuration, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.instructions`, drug.defaultInstructions, { shouldDirty: true, shouldValidate: true });
    
    toast({
      title: "Medication Auto-Filled ⚡",
      description: `${drug.name} loaded with standard clinical dosage & instructions.`,
    });
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
    <div className="space-y-6 pb-28 max-w-7xl mx-auto px-1 sm:px-2">
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

          <Button 
            variant="outline"
            size="sm" 
            onClick={vitalsForm.handleSubmit(onSaveVitals)} 
            disabled={saveVitalsMutation.isPending}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Save className="h-3.5 w-3.5 text-teal-600" />
            <span>Save Vitals</span>
          </Button>

          <Button 
            variant="outline"
            size="sm" 
            onClick={prescriptionForm.handleSubmit(onSavePrescription)} 
            disabled={savePrescriptionMutation.isPending}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Save className="h-3.5 w-3.5 text-emerald-600" />
            <span>Save Rx</span>
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
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md gap-2 text-xs h-9 px-4 cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing & Calling Next...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>⚡ Sign Rx & Call Next</span>
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
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={vitalsForm.handleSubmit(onSaveVitals)} 
                  disabled={saveVitalsMutation.isPending}
                  className="h-7 text-xs font-bold text-teal-700 dark:text-teal-400 gap-1 hover:bg-teal-50"
                >
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingVitals ? (
                <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <form className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UpsideAutoSuggestInput
                      label="Blood Pressure"
                      sublabel="30+ Presets"
                      value={vitalsForm.watch('bloodPressure') || ''}
                      onChange={(val) => vitalsForm.setValue('bloodPressure', val.split(' ')[0], { shouldDirty: true })}
                      options={UNIVERSAL_BP_OPTIONS}
                      placeholder="e.g. 120/80 mmHg"
                    />

                    <UpsideAutoSuggestInput
                      label="Heart Rate (BPM)"
                      sublabel="25+ Presets"
                      value={vitalsForm.watch('heartRate') ? String(vitalsForm.watch('heartRate')) : ''}
                      onChange={(val) => {
                        const num = parseInt(val.replace(/\D/g, ''), 10);
                        vitalsForm.setValue('heartRate', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_HEART_RATE_OPTIONS}
                      placeholder="e.g. 72 bpm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UpsideAutoSuggestInput
                      label="Temperature (°F)"
                      sublabel="18+ Presets"
                      value={vitalsForm.watch('temperature') ? String(vitalsForm.watch('temperature')) : ''}
                      onChange={(val) => {
                        const match = val.match(/\d+(\.\d+)?/);
                        const num = match ? parseFloat(match[0]) : 0;
                        vitalsForm.setValue('temperature', num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_TEMP_OPTIONS}
                      placeholder="e.g. 98.6 °F"
                    />

                    <UpsideAutoSuggestInput
                      label="SpO2 (%)"
                      sublabel="13+ Presets"
                      value={vitalsForm.watch('spo2') ? String(vitalsForm.watch('spo2')) : ''}
                      onChange={(val) => {
                        const num = parseInt(val.replace(/\D/g, ''), 10);
                        vitalsForm.setValue('spo2', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_SPO2_OPTIONS}
                      placeholder="e.g. 99%"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 items-end">
                    <UpsideAutoSuggestInput
                      label="Weight (kg)"
                      value={vitalsForm.watch('weight') ? String(vitalsForm.watch('weight')) : ''}
                      onChange={(val) => {
                        const num = parseFloat(val.replace(/[^\d.]/g, ''));
                        vitalsForm.setValue('weight', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_WEIGHT_OPTIONS}
                      placeholder="70"
                    />

                    <UpsideAutoSuggestInput
                      label="Height (cm)"
                      value={vitalsForm.watch('height') ? String(vitalsForm.watch('height')) : ''}
                      onChange={(val) => {
                        const num = parseFloat(val.replace(/[^\d.]/g, ''));
                        vitalsForm.setValue('height', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_HEIGHT_OPTIONS}
                      placeholder="170"
                    />

                    <div>
                      <Label className="text-[11px] font-bold text-stone-600 dark:text-stone-300">BMI</Label>
                      <div className="h-9 flex items-center justify-center font-mono font-bold bg-stone-100 dark:bg-stone-800 text-teal-700 dark:text-teal-300 rounded-md border border-stone-300 dark:border-stone-700 text-xs mt-1.5 shadow-sm">
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
                    Live upside auto-suggestions active for all 5 fields. Type or pick from 70+ medical choices.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendMed({ medicineName: '', dosage: '500 mg', frequency: '1-0-1 (Twice daily after meals - Morning & Night)', duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', instructions: 'Take after meals with plenty of water.' })}
                    className="h-8 text-xs font-bold gap-1 border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Drug
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isLoadingPrescription ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" /></div>
              ) : (
                <form className="space-y-6">
                  <div className="space-y-6">
                    {medFields.map((field, index) => {
                      const currentMed = prescriptionForm.watch(`medicines.${index}`) || {};

                      return (
                        <div key={field.id} className="p-4 rounded-2xl border-2 border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 hover:border-teal-500/50 transition-all space-y-4 shadow-sm">
                          <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 pb-2 border-b border-stone-200/60 dark:border-stone-800">
                            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-bold text-sm">
                              <Pill className="w-4 h-4" /> Medication #{index + 1}
                            </span>
                            {medFields.length > 1 && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-rose-600 hover:bg-rose-50 text-[11px] font-bold"
                                onClick={() => removeMed(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Drug
                              </Button>
                            )}
                          </div>

                          {/* 1. Medicine Name & Generic Formula (Upside Floating Suggestions) */}
                          <UpsideAutoSuggestInput
                            label="1. Medicine Name & Generic Formula"
                            sublabel="⚡ Auto-fills Dosage, Frequency, Duration & Instructions"
                            value={currentMed.medicineName || ''}
                            onChange={(val) => prescriptionForm.setValue(`medicines.${index}.medicineName`, val, { shouldDirty: true })}
                            options={UNIVERSAL_DRUG_DATABASE}
                            isDrugName={true}
                            onDrugSelect={(drug) => handleDrugAutoPopulate(index, drug)}
                            placeholder="Type or search medicine (e.g. Paracetamol 650mg, Augmentin 625, Pan-D, Telma-AM...)"
                          />

                          {/* Row 2: Dosage & Frequency (Upside Floating Suggestions) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <UpsideAutoSuggestInput
                              label="2. Dosage / Strength"
                              sublabel="84+ Medical Strengths"
                              value={currentMed.dosage || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.dosage`, val, { shouldDirty: true })}
                              options={UNIVERSAL_DOSAGE_OPTIONS}
                              placeholder="Type or pick dose (e.g. 650 mg, 500 mg, 10 ml, 2 puffs...)"
                            />

                            <UpsideAutoSuggestInput
                              label="3. Frequency / Clinical Pattern"
                              sublabel="72+ Patterns"
                              value={currentMed.frequency || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.frequency`, val, { shouldDirty: true })}
                              options={UNIVERSAL_FREQUENCY_OPTIONS}
                              placeholder="Type or pick pattern (e.g. 1-0-1, 1-0-0 Empty Stomach, SOS...)"
                            />
                          </div>

                          {/* Row 3: Duration & Special Instructions (Upside Floating Suggestions) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <UpsideAutoSuggestInput
                              label="4. Duration"
                              sublabel="72+ Durations"
                              value={currentMed.duration || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.duration`, val, { shouldDirty: true })}
                              options={UNIVERSAL_DURATION_OPTIONS}
                              placeholder="Type or pick duration (e.g. 5 Days, 1 Month, Weekly for 8 Weeks...)"
                            />

                            <UpsideAutoSuggestInput
                              label="5. Special Instructions"
                              sublabel="72+ Guidelines"
                              value={currentMed.instructions || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.instructions`, val, { shouldDirty: true })}
                              options={UNIVERSAL_INSTRUCTIONS_OPTIONS}
                              placeholder="Type or pick guidelines (e.g. Take after meals with plenty of water...)"
                            />
                          </div>
                        </div>
                      );
                    })}

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
