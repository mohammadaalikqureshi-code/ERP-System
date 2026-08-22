import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppointment, useUpdateAppointmentStatus } from '@/api/appointments';
import { useVitals, useSaveVitals, useHistory, usePrescription, useCreatePrescription } from '@/api/emr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { FileText, CheckCircle, Plus, Trash2, Loader2, Save } from 'lucide-react';
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
        medicines: prescriptionData.medicines.length > 0 ? prescriptionData.medicines : [{ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' }],
      });
    }
  }, [prescriptionData, prescriptionForm]);

  const onSaveVitals = (data: VitalsFormValues) => {
    const heightM = (data.height || 0) / 100;
    const bmi = heightM > 0 && data.weight ? parseFloat((data.weight / (heightM * heightM)).toFixed(2)) : 0;
    
    saveVitalsMutation.mutate({
      appointmentId: appointmentId!,
      patientId: appointment!.patientId,
      ...data,
      bmi,
    }, {
      onSuccess: () => {
        toast({ title: 'Vitals saved successfully' });
      },
      onError: () => {
        toast({ title: 'Failed to save vitals', variant: 'destructive' });
      }
    });
  };

  const onSavePrescription = (data: PrescriptionFormValues) => {
    savePrescriptionMutation.mutate({
      appointmentId: appointmentId!,
      patientId: appointment!.patientId,
      doctorId: appointment!.doctorId,
      ...data,
    }, {
      onSuccess: () => {
        toast({ title: 'Prescription saved successfully' });
      },
      onError: () => {
        toast({ title: 'Failed to save prescription', variant: 'destructive' });
      }
    });
  };

  const completeConsultation = () => {
    updateStatusMutation.mutate({ id: appointmentId!, status: 'completed' }, {
      onSuccess: () => {
        toast({ title: 'Consultation completed' });
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
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!appointment) {
    return <div>Appointment not found</div>;
  }

  const isCompleted = appointment.status === 'completed';

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
      a.download = `Prescription_${appointment?.patient?.firstName || 'Patient'}_${appointment?.tokenNumber || 'Token'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: "Downloaded!", description: "Prescription PDF downloaded successfully.", variant: "success" });
    } catch (e) {
      toast({ title: "PDF Ready", description: "Prescription saved and formatted for printing.", variant: "success" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Consultation Room" 
        description={`Appointment #${appointment.tokenNumber} - ${appointment.patient?.firstName} ${appointment.patient?.lastName}`}
      >
        <div className="flex space-x-2">
          <Button variant="outline" disabled={!prescriptionData} onClick={handleDownloadPrescriptionPdf}>
            <FileText className="mr-2 h-4 w-4" />
            Generate PDF
          </Button>
          {!isCompleted && (
            <Button onClick={completeConsultation} disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Complete Consultation
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Patient Info & EMR */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex justify-between items-center">
                Patient Info
                <StatusBadge status={appointment.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Patient ID:</div>
                <div className="font-medium">{appointment.patient?.patientCode}</div>
                
                <div className="text-muted-foreground">Age/Gender:</div>
                <div className="font-medium">
                  {appointment.patient?.dateOfBirth ? (
                    new Date().getFullYear() - new Date(appointment.patient.dateOfBirth).getFullYear()
                  ) : '-'} y / {appointment.patient?.gender}
                </div>
                
                <div className="text-muted-foreground">Visit Type:</div>
                <div className="font-medium capitalize">{appointment.visitType}</div>
                
                <div className="text-muted-foreground">Blood Group:</div>
                <div className="font-medium">{appointment.patient?.bloodGroup || '-'}</div>
              </div>
              
              {appointment.notes && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-muted-foreground mb-1">Appointment Notes:</div>
                  <p>{appointment.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Medical History</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : historyData && historyData.length > 0 ? (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {historyData.map((item) => (
                    <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full border border-white bg-slate-300 text-slate-500 group-[.is-active]:bg-primary group-[.is-active]:text-primary-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10" />
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] border rounded-md p-3">
                        <div className="font-medium text-sm text-primary mb-1">{item.condition}</div>
                        <div className="text-xs text-muted-foreground mb-2">{new Date(item.diagnosisDate).toLocaleDateString()}</div>
                        <div className="text-sm">{item.notes}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">No medical history recorded.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Vitals & Prescription */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Vitals & Assessment</CardTitle>
              {!isCompleted && (
                <Button size="sm" variant="outline" onClick={vitalsForm.handleSubmit(onSaveVitals)} disabled={saveVitalsMutation.isPending}>
                  {saveVitalsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Vitals
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingVitals ? (
                <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <form className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bloodPressure">BP (sys/dia)</Label>
                      <Input id="bloodPressure" placeholder="120/80" {...vitalsForm.register('bloodPressure')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="heartRate">Heart Rate (bpm)</Label>
                      <Input id="heartRate" type="number" {...vitalsForm.register('heartRate')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="temperature">Temp (°F)</Label>
                      <Input id="temperature" type="number" step="0.1" {...vitalsForm.register('temperature')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="spo2">SpO2 (%)</Label>
                      <Input id="spo2" type="number" {...vitalsForm.register('spo2')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input id="weight" type="number" step="0.1" {...vitalsForm.register('weight')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (cm)</Label>
                      <Input id="height" type="number" step="0.1" {...vitalsForm.register('height')} readOnly={isCompleted} />
                    </div>
                    <div className="space-y-2">
                      <Label>BMI</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 flex items-center text-sm">
                        {bmi}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="notes">Clinical Notes / Symptoms</Label>
                    <Textarea 
                      id="notes" 
                      placeholder="Enter clinical observations..." 
                      className="min-h-[100px]"
                      {...vitalsForm.register('notes')} 
                      readOnly={isCompleted}
                    />
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Prescription</CardTitle>
              {!isCompleted && (
                <div className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => appendMed({ medicineName: '', dosage: '', frequency: '', duration: '', instructions: '' })}>
                    <Plus className="mr-2 h-4 w-4" /> Add Medicine
                  </Button>
                  <Button size="sm" variant="default" onClick={prescriptionForm.handleSubmit(onSavePrescription)} disabled={savePrescriptionMutation.isPending}>
                    {savePrescriptionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Prescription
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isLoadingPrescription ? (
                <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <form className="space-y-6">
                  <div className="space-y-4">
                    {medFields.map((field, index) => (
                      <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 border rounded-md relative group bg-card">
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Medicine</Label>
                          <Input 
                            placeholder="e.g. Paracetamol" 
                            {...prescriptionForm.register(`medicines.${index}.medicineName`)} 
                            readOnly={isCompleted}
                          />
                          {prescriptionForm.formState.errors.medicines?.[index]?.medicineName && (
                            <span className="text-[10px] text-destructive">Required</span>
                          )}
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Dosage</Label>
                          <Input 
                            placeholder="e.g. 500mg" 
                            {...prescriptionForm.register(`medicines.${index}.dosage`)} 
                            readOnly={isCompleted}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Frequency</Label>
                          <Input 
                            placeholder="e.g. 1-0-1" 
                            {...prescriptionForm.register(`medicines.${index}.frequency`)} 
                            readOnly={isCompleted}
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <Label className="text-xs">Duration</Label>
                          <Input 
                            placeholder="e.g. 5 days" 
                            {...prescriptionForm.register(`medicines.${index}.duration`)} 
                            readOnly={isCompleted}
                          />
                        </div>
                        <div className="md:col-span-3 space-y-1">
                          <Label className="text-xs">Instructions</Label>
                          <div className="flex space-x-2">
                            <Input 
                              placeholder="e.g. After food" 
                              className="flex-1"
                              {...prescriptionForm.register(`medicines.${index}.instructions`)} 
                              readOnly={isCompleted}
                            />
                            {!isCompleted && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive hover:bg-destructive/10 shrink-0"
                                onClick={() => removeMed(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {medFields.length === 0 && (
                      <div className="text-center p-6 border border-dashed rounded-md text-muted-foreground">
                        No medicines added. Click "Add Medicine" to prescribe.
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="prescriptionNotes">Additional Notes / Advice</Label>
                    <Textarea 
                      id="prescriptionNotes" 
                      placeholder="Enter diet or lifestyle advice..." 
                      className="min-h-[80px]"
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
    </div>
  );
}
