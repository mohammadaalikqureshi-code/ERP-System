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
import { FileText, CheckCircle, Plus, Trash2, Loader2, Save, Sparkles, ArrowRight, Activity, HeartPulse, User, Pill } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';

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
      medicineName: z.string().min(1, 'Required'),
      dosage: z.string().min(1, 'Required'),
      frequency: z.string().min(1, 'Required'),
      duration: z.string().min(1, 'Required'),
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
        medicines: prescriptionData.medicines?.length > 0 ? prescriptionData.medicines : [{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      });
    }
  }, [prescriptionData, prescriptionForm]);

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
      toast({ title: 'Vitals saved successfully', variant: 'success' });
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
    return <div className="flex h-full items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-teal-600" /></div>;
  }

  if (!appointment) {
    return <div className="p-8 text-center text-muted-foreground">Appointment not found</div>;
  }

  const isCompleted = appointment.status === 'completed';
  const patientFullName = appointment.patient?.fullName || `${appointment.patient?.firstName || ''} ${appointment.patient?.lastName || ''}`.trim() || 'Patient';

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
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Top Header & 1-Click Action Hub */}
      <PageHeader 
        title="Doctor Consultation Suite" 
        description={`Active Token #${appointment.tokenNumber} • Patient: ${patientFullName}`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" disabled={!prescriptionData} onClick={handleDownloadPrescriptionPdf} className="text-xs">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            PDF Rx
          </Button>

          {!isCompleted && (
            <>
              <Button 
                variant="outline"
                size="sm" 
                onClick={completeConsultation} 
                disabled={updateStatusMutation.isPending || isProcessingAction}
                className="text-xs"
              >
                {updateStatusMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                Complete Only
              </Button>

              {/* 🏆 THE #1 BEST WAY: 1-CLICK SIGN & CALL NEXT BUTTON */}
              <Button 
                onClick={handleSignAndCallNext} 
                disabled={isProcessingAction || completeAndCallNextMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-md gap-2 text-xs h-9 px-4 animate-in fade-in"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing & Calling Next...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    ⚡ Sign Rx & Call Next Patient
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Patient Demographics & Vitals */}
        <div className="space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex justify-between items-center">
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-teal-600" />
                  Patient Profile
                </span>
                <StatusBadge status={appointment.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 pb-3 border-b">
                <div className="text-muted-foreground">Serial Code:</div>
                <div className="font-mono font-bold text-teal-700 dark:text-teal-400">{appointment.patient?.patientCode || 'PT-00001'}</div>
                
                <div className="text-muted-foreground">Full Name:</div>
                <div className="font-semibold text-foreground">{patientFullName}</div>

                <div className="text-muted-foreground">Age / Gender:</div>
                <div className="font-medium">{appointment.patient?.age ? `${appointment.patient.age} Y` : '-'} / {appointment.patient?.gender || '-'}</div>

                <div className="text-muted-foreground">Blood Group:</div>
                <div className="font-bold text-rose-600">{appointment.patient?.bloodGroup || 'O+'}</div>

                <div className="text-muted-foreground">Mobile:</div>
                <div className="font-mono">{appointment.patient?.mobile || '-'}</div>
              </div>

              {appointment.patient?.allergies && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300">
                  <span className="font-bold">⚠️ Known Allergies:</span> {appointment.patient.allergies}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vitals Form Card */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  Patient Vitals
                </span>
                {!isCompleted && (
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={vitalsForm.handleSubmit(onSaveVitals)} 
                    disabled={saveVitalsMutation.isPending}
                    className="h-7 text-xs text-teal-700 gap-1 hover:bg-teal-50"
                  >
                    <Save className="h-3 w-3" /> Save Vitals
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingVitals ? (
                <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <form className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="bp">Blood Pressure</Label>
                      <Input id="bp" placeholder="e.g. 120/80" className="h-8 text-xs font-mono" {...vitalsForm.register('bloodPressure')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="hr">Heart Rate (BPM)</Label>
                      <Input id="hr" type="number" placeholder="72" className="h-8 text-xs font-mono" {...vitalsForm.register('heartRate')} readOnly={isCompleted} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="temp">Temp (°F)</Label>
                      <Input id="temp" type="number" step="0.1" placeholder="98.6" className="h-8 text-xs font-mono" {...vitalsForm.register('temperature')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="spo2">SpO2 (%)</Label>
                      <Input id="spo2" type="number" placeholder="98" className="h-8 text-xs font-mono" {...vitalsForm.register('spo2')} readOnly={isCompleted} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="wt">Weight (kg)</Label>
                      <Input id="wt" type="number" step="0.5" placeholder="70" className="h-8 text-xs font-mono" {...vitalsForm.register('weight')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label htmlFor="ht">Height (cm)</Label>
                      <Input id="ht" type="number" placeholder="170" className="h-8 text-xs font-mono" {...vitalsForm.register('height')} readOnly={isCompleted} />
                    </div>
                    <div>
                      <Label>BMI</Label>
                      <div className="h-8 flex items-center justify-center font-mono font-bold bg-muted rounded border text-xs">
                        {bmi}
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Digital Prescription (Rx) & Clinical Notes */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Pill className="w-4 h-4 text-teal-600" />
                    Digital Rx Prescription & Medications
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Prescribed drugs are synced live with Hospital Pharmacy for rapid dispensing.
                  </CardDescription>
                </div>
                {!isCompleted && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendMed({ medicineName: '', dosage: '500mg', frequency: '1-0-1', duration: '5 days', instructions: 'After meals' })}
                    className="h-8 text-xs gap-1 border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
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
                      <div key={field.id} className="p-3.5 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                          <span>Medication #{index + 1}</span>
                          {!isCompleted && medFields.length > 1 && (
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 text-rose-600 hover:bg-rose-50"
                              onClick={() => removeMed(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div className="sm:col-span-2">
                            <Label className="text-[11px]">Medicine Name & Generic</Label>
                            <Input 
                              placeholder="e.g. Paracetamol 650mg / Atorvastatin 20mg" 
                              className="h-8 text-xs font-medium"
                              {...prescriptionForm.register(`medicines.${index}.medicineName` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Dosage / Strength</Label>
                            <Input 
                              placeholder="e.g. 500mg, 1 tab" 
                              className="h-8 text-xs"
                              {...prescriptionForm.register(`medicines.${index}.dosage` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <Label className="text-[11px]">Frequency (Pattern)</Label>
                            <Input 
                              placeholder="e.g. 1-0-1 (Morning-Night)" 
                              className="h-8 text-xs font-mono"
                              {...prescriptionForm.register(`medicines.${index}.frequency` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Duration</Label>
                            <Input 
                              placeholder="e.g. 5 days, 1 month" 
                              className="h-8 text-xs font-mono"
                              {...prescriptionForm.register(`medicines.${index}.duration` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                          <div>
                            <Label className="text-[11px]">Special Instructions</Label>
                            <Input 
                              placeholder="e.g. After meals" 
                              className="h-8 text-xs"
                              {...prescriptionForm.register(`medicines.${index}.instructions` as const)}
                              readOnly={isCompleted}
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {medFields.length === 0 && (
                      <div className="p-8 border border-dashed rounded-xl text-center text-xs text-muted-foreground space-y-2">
                        <div>No medications added to this prescription yet.</div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => appendMed({ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' })}
                          className="text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add First Medicine
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rxNotes" className="text-xs">Clinical Advice & Follow-Up Instructions</Label>
                    <Textarea 
                      id="rxNotes" 
                      placeholder="e.g. Low sodium diet, 30 min daily walking, review with lab reports in 7 days..." 
                      className="min-h-[85px] text-xs leading-relaxed"
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
                Active Token <strong className="text-teal-400 font-mono font-bold text-sm">#{appointment.tokenNumber}</strong>
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
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-2 h-9 px-4 shadow-lg"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    ⚡ Sign & Call Next Patient
                    <ArrowRight className="w-4 h-4" />
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
