import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBills, useCreateBill } from '@/api/billing';
import { useSearchPatients } from '@/api/patients';
import { useInventory } from '@/api/inventory';
import { useDebounce } from '@/hooks/useDebounce';
import { billCreateSchema } from '@/lib/validations';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Trash2, Receipt, Download, ShoppingCart } from 'lucide-react';
import { Patient } from '@/types';

import { z } from 'zod';

type BillFormValues = z.infer<typeof billCreateSchema>;

const BillingPageContent = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('create');
  
  // For Search
  const [patientSearch, setPatientSearch] = useState('');
  const debouncedPatientSearch = useDebounce(patientSearch, 300);
  const { data: patients, isLoading: searchingPatients } = useSearchPatients(debouncedPatientSearch);
  
  // For Catalog
  const { data: inventoryData } = useInventory({ pageSize: 100 });
  
  // For Bills List
  const [page, setPage] = useState(1);
  const { data: billsData, isLoading: loadingBills, refetch: refetchBills } = useBills({ page, pageSize: 10 });
  
  const { mutateAsync: createBill, isPending: isCreating } = useCreateBill();

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billCreateSchema),
    defaultValues: {
      patientId: '',
      items: [{ description: 'Consultation Fee', quantity: 1, unitPrice: 500 }],
      discount: 0,
      paymentMode: 'CASH',
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const items = form.watch('items');
  const discount = form.watch('discount') || 0;
  
  const subtotal = items.reduce((sum: number, item: any) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  const gstAmount = subtotal * 0.18; // 18% GST
  const total = Math.max(0, subtotal + gstAmount - discount);

  const selectedPatientId = form.watch('patientId');
  const selectedPatient = patients?.find((p: Patient) => p.id === selectedPatientId);

  const onSubmit = async (data: BillFormValues) => {
    try {
      const result = await createBill(data);
      toast({
        title: "Bill Generated Successfully",
        description: `Bill No: ${result.billNumber}`,
        variant: "success",
      });
      form.reset();
      setActiveTab('list');
      refetchBills();
    } catch (error: any) {
      toast({
        title: "Billing Failed",
        description: error.response?.data?.message || "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPdf = async (billId: string) => {
    try {
      await downloadFile(`/billing/bills/${billId}/pdf`, `receipt-${billId}.pdf`);
    } catch (error: any) {
      toast({
        title: 'Could not download receipt',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const columns = [
    { key: 'billNumber', label: 'Bill No.', render: (val: string) => <span className="font-mono font-medium">{val}</span> },
    { key: 'createdAt', label: 'Date', render: (val: string) => new Date(val).toLocaleDateString() },
    { key: 'patient', label: 'Patient', render: (_: any, row: any) => `${row.patient?.firstName || ''} ${row.patient?.lastName || ''}` },
    { key: 'totalAmount', label: 'Amount', render: (val: number) => `₹${val.toFixed(2)}` },
    { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
    { key: 'id', label: 'Actions', render: (val: string) => (
      <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(val)}>
        <Download className="h-4 w-4" />
      </Button>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Billing & Invoicing" description="Create new bills and manage payments." />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="create">Create Bill</TabsTrigger>
          <TabsTrigger value="list">All Bills</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create" className="pt-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Bill Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="billing-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  {/* Patient Selection */}
                  <div className="space-y-4">
                    <Label>Select Patient</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search patient by mobile or name..." 
                        className="pl-8"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                      />
                    </div>
                    {patientSearch.length >= 3 && (
                      <div className="max-h-40 overflow-y-auto border rounded-md absolute z-10 bg-background w-full max-w-md shadow-md">
                        {searchingPatients && <div className="p-2 text-sm text-center">Searching...</div>}
                        {patients?.map((patient: Patient) => (
                          <div 
                            key={patient.id} 
                            className="p-2 border-b cursor-pointer hover:bg-muted"
                            onClick={() => {
                              form.setValue('patientId', patient.id);
                              setPatientSearch('');
                            }}
                          >
                            <span className="font-medium">{patient.firstName} {patient.lastName}</span> - {patient.mobile}
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedPatient && (
                      <div className="p-3 bg-muted/50 rounded-md flex justify-between items-center">
                        <div>
                          <span className="font-medium block">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                          <span className="text-xs text-muted-foreground">ID: {selectedPatient.patientCode}</span>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue('patientId', '')}>Change</Button>
                      </div>
                    )}
                    {form.formState.errors.patientId && <p className="text-sm text-destructive">Patient is required</p>}
                  </div>

                  {/* Line Items */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Line Items</Label>
                      <div className="flex gap-2">
                        <Select onValueChange={(val) => {
                          const item = inventoryData?.data?.find((i: any) => i.id === val);
                          if (item) {
                            append({ description: item.name, quantity: 1, unitPrice: item.unitPrice });
                          } else if (val === 'consult') {
                            append({ description: 'Consultation Fee', quantity: 1, unitPrice: 500 });
                          } else if (val === 'lab_cbc') {
                            append({ description: 'Lab Test - CBC', quantity: 1, unitPrice: 300 });
                          }
                        }}>
                          <SelectTrigger className="w-[180px] h-9">
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Add from Catalog" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consult">Consultation Fee</SelectItem>
                            <SelectItem value="lab_cbc">Lab Test - CBC</SelectItem>
                            {inventoryData?.data?.map((item: any) => (
                              <SelectItem key={item.id} value={item.id}>{item.name} - ₹{item.unitPrice}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}>
                          <Plus className="h-4 w-4 mr-1" /> Custom Item
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-3 items-start">
                          <div className="flex-1 space-y-1">
                            <Input placeholder="Description" {...form.register(`items.${index}.description` as const)} />
                            {form.formState.errors.items?.[index]?.description && <p className="text-xs text-destructive">Required</p>}
                          </div>
                          <div className="w-20 space-y-1">
                            <Input type="number" placeholder="Qty" {...form.register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                          </div>
                          <div className="w-32 space-y-1">
                            <Input type="number" placeholder="Price" {...form.register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                          </div>
                          <div className="w-24 pt-2 font-medium text-right">
                            ₹{((items[index]?.quantity || 0) * (items[index]?.unitPrice || 0)).toFixed(2)}
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount (₹)</Label>
                      <Input type="number" {...form.register('discount', { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select onValueChange={(value) => form.setValue('paymentMode', value as any)} defaultValue={form.getValues('paymentMode')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash</SelectItem>
                          <SelectItem value="UPI">UPI</SelectItem>
                          <SelectItem value="CARD">Card</SelectItem>
                          <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                </form>
              </CardContent>
            </Card>

            <Card className="h-fit sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST (18%)</span>
                  <span>+₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>Discount</span>
                  <span>-₹{discount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-4 flex justify-between font-bold text-lg">
                  <span>Total Amount</span>
                  <span>₹{total.toFixed(2)}</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" form="billing-form" className="w-full" disabled={isCreating || !selectedPatientId}>
                  {isCreating ? 'Generating...' : 'Generate Bill & Collect Payment'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="list" className="pt-4">
          <DataTable
            columns={columns}
            data={billsData?.data || []}
            isLoading={loadingBills}
            page={page}
            pageSize={10}
            total={billsData?.total || 0}
            onPageChange={setPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default function BillingPage() {
  return (
    <ErrorBoundary>
      <BillingPageContent />
    </ErrorBoundary>
  );
}
