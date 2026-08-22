import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { appointmentCreateSchema } from '@/lib/validations';
import { useCreateAppointment } from '@/api/appointments';
import { useDoctors, useAvailableSlots } from '@/api/doctors';
import { useSearchPatients } from '@/api/patients';
import { useDebounce } from '@/hooks/useDebounce';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search, CheckCircle2 } from 'lucide-react';
import { Patient, Doctor, AvailableSlot } from '@/types';

type BookingFormValues = z.infer<typeof appointmentCreateSchema>;

const AppointmentBookingContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch, 300);
  
  const { data: patients, isLoading: searchingPatients } = useSearchPatients(debouncedPatientSearch);
  const { data: doctors, isLoading: loadingDoctors } = useDoctors();
  const { mutateAsync: createAppointment, isPending } = useCreateAppointment();

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

  const selectedDoctorId = form.watch('doctorId');
  const selectedDate = form.watch('appointmentDate');
  const selectedTime = form.watch('appointmentTime');
  const selectedPatientId = form.watch('patientId');
  const selectedPatient = patients?.find((p: Patient) => p.id === selectedPatientId);
  const selectedDoctor = doctors?.find((d: Doctor) => d.id === selectedDoctorId);

  const { data: slots, isLoading: loadingSlots } = useAvailableSlots(selectedDoctorId, selectedDate);

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

  const onSubmit = async (data: BookingFormValues) => {
    try {
      const result = await createAppointment(data);
      toast({
        title: "Appointment Booked",
        description: `Token Number: ${result.tokenNumber}`,
        variant: "success",
      });
      setStep(5); // Success step
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.response?.data?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <PageHeader title="Book Appointment" description={`Step ${step} of 4`} />
      
      <div className="flex justify-between items-center mb-8 relative">
        <div className="absolute left-0 top-1/2 w-full h-1 bg-muted -z-10 -translate-y-1/2"></div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} font-bold text-sm`}>
            {i}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* STEP 1: Patient Selection */}
            {step === 1 && (
              <div className="space-y-4">
                <CardTitle>Select Patient</CardTitle>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search patient by mobile or name..." 
                    className="pl-8"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  {searchingPatients && <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>}
                  {!searchingPatients && patients?.length === 0 && patientSearch.length >= 3 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">No patients found. <Button variant="link" onClick={() => navigate('/reception/patients')}>Register New Patient</Button></div>
                  )}
                  {patients?.map((patient: Patient) => (
                    <div 
                      key={patient.id} 
                      className={`p-3 border-b cursor-pointer hover:bg-muted/50 ${selectedPatientId === patient.id ? 'bg-muted border-primary' : ''}`}
                      onClick={() => form.setValue('patientId', patient.id)}
                    >
                      <div className="font-medium">{patient.firstName} {patient.lastName} ({patient.patientCode})</div>
                      <div className="text-sm text-muted-foreground">{patient.mobile}</div>
                    </div>
                  ))}
                </div>
                <Button type="button" onClick={handleNext} disabled={!selectedPatientId} className="w-full">Next: Select Doctor</Button>
              </div>
            )}

            {/* STEP 2: Doctor Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <CardTitle>Select Doctor</CardTitle>
                <div className="grid gap-4 md:grid-cols-2">
                  {loadingDoctors && <div className="p-4 text-center text-sm text-muted-foreground col-span-2">Loading doctors...</div>}
                  {doctors?.map((doctor: Doctor) => (
                    <div 
                      key={doctor.id} 
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedDoctorId === doctor.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
                      onClick={() => form.setValue('doctorId', doctor.id)}
                    >
                      <div className="font-semibold text-lg">Dr. {doctor.firstName} {doctor.lastName}</div>
                      <div className="text-sm text-muted-foreground">{doctor.specialization} - {doctor.department}</div>
                      <div className="text-sm font-medium mt-2">Fee: ₹{doctor.consultationFee}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4">
                  <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                  <Button type="button" onClick={handleNext} disabled={!selectedDoctorId} className="flex-1">Next: Select Time</Button>
                </div>
              </div>
            )}

            {/* STEP 3: Date & Slot Selection */}
            {step === 3 && (
              <div className="space-y-4">
                <CardTitle>Select Date & Time</CardTitle>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" {...form.register('appointmentDate')} min={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <div className="space-y-2">
                  <Label>Available Slots</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {loadingSlots && <div className="col-span-full text-sm text-muted-foreground py-4">Loading slots...</div>}
                    {!loadingSlots && (!slots || slots.length === 0) && (
                      <div className="col-span-full text-sm text-muted-foreground py-4">No slots available for this date.</div>
                    )}
                    {slots?.map((slot: AvailableSlot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.isAvailable}
                        onClick={() => form.setValue('appointmentTime', slot.time)}
                        className={`p-2 text-center text-sm rounded-md border ${
                          selectedTime === slot.time 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : slot.isAvailable 
                              ? 'hover:border-primary cursor-pointer' 
                              : 'opacity-50 cursor-not-allowed bg-muted'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                  <Button type="button" onClick={handleNext} disabled={!selectedTime} className="flex-1">Next: Visit Details</Button>
                </div>
              </div>
            )}

            {/* STEP 4: Visit Details & Confirm */}
            {step === 4 && (
              <div className="space-y-4">
                <CardTitle>Confirm Booking</CardTitle>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm mb-6">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-muted-foreground">Patient:</div>
                    <div className="font-medium">{selectedPatient?.firstName} {selectedPatient?.lastName}</div>
                    <div className="text-muted-foreground">Doctor:</div>
                    <div className="font-medium">Dr. {selectedDoctor?.firstName} {selectedDoctor?.lastName}</div>
                    <div className="text-muted-foreground">Date:</div>
                    <div className="font-medium">{selectedDate} at {selectedTime}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Visit Type</Label>
                  <Select onValueChange={(value) => form.setValue('visitType', value as any)} defaultValue={form.getValues('visitType')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select visit type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New Visit</SelectItem>
                      <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                      <SelectItem value="EMERGENCY">Emergency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={handleBack}>Back</Button>
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending ? 'Booking...' : 'Confirm Appointment'}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 5: Success */}
            {step === 5 && (
              <div className="text-center space-y-4 py-8">
                <div className="flex justify-center text-green-500 mb-4">
                  <CheckCircle2 className="h-16 w-16" />
                </div>
                <CardTitle className="text-2xl">Booking Confirmed!</CardTitle>
                <p className="text-muted-foreground">The appointment has been successfully scheduled.</p>
                <div className="pt-6 flex justify-center gap-4">
                  <Button type="button" onClick={() => navigate('/reception/queue')}>Go to Queue</Button>
                  <Button type="button" variant="outline" onClick={() => { form.reset(); setStep(1); }}>Book Another</Button>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
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
