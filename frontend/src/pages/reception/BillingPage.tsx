import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useBills, useCreateBill } from '@/api/billing';
import { useDailyCashRegister } from '@/api/settings';
import { useSearchPatients } from '@/api/patients';
import { useInventory } from '@/api/inventory';
import { useDebounce } from '@/hooks/useDebounce';
import { billCreateSchema } from '@/lib/validations';
import { downloadFile } from '@/lib/download';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, Trash2, Download, ShoppingCart, DollarSign, CreditCard, Receipt, Calendar, ArrowRight } from 'lucide-react';
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

  // For Daily Cash Register
  const [registerDate, setRegisterDate] = useState(new Date().toISOString().split('T')[0]);
  const { data: registerData, isLoading: loadingRegister } = useDailyCashRegister(registerDate);
  
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
  const taxableAmount = Math.max(0, subtotal - discount);
  const cgstAmount = taxableAmount * 0.09; // 9% CGST
  const sgstAmount = taxableAmount * 0.09; // 9% SGST
  const gstAmount = cgstAmount + sgstAmount; // 18% Total GST
  const total = Math.max(0, taxableAmount + gstAmount);

  const selectedPatientId = form.watch('patientId');
  const selectedPatient = patients?.find((p: Patient) => p.id === selectedPatientId);

  const onSubmit = async (data: BillFormValues) => {
    try {
      const result = await createBill(data);
      toast({
        title: "Tax Invoice Generated",
        description: `Bill #${result.billNumber} for ₹${result.totalAmount || total} generated. SMS sent to patient.`,
        variant: "success",
      });
      form.reset({
        patientId: '',
        items: [{ description: 'Consultation Fee', quantity: 1, unitPrice: 500 }],
        discount: 0,
        paymentMode: 'CASH',
      });
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
      await downloadFile(`/billing/bills/${billId}/pdf`, `invoice-${billId}.pdf`);
      toast({ title: 'Invoice Downloaded' });
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
    { key: 'patient', label: 'Patient', render: (_: any, row: any) => (
      <div>
        <div className="font-medium">{row.patient?.firstName || ''} {row.patient?.lastName || ''}</div>
        <div className="text-xs text-muted-foreground">{row.patient?.patientCode || ''}</div>
      </div>
    ) },
    { key: 'payment_mode', label: 'Mode', render: (val: string, row: any) => (
      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-secondary uppercase">
        {val || row.paymentMode || 'CASH'}
      </span>
    ) },
    { key: 'totalAmount', label: 'Amount', render: (val: number, row: any) => (
      <span className="font-bold">₹{parseFloat(val || row.total_amount || 0).toFixed(2)}</span>
    ) },
    { key: 'status', label: 'Status', render: (val: string) => <StatusBadge status={val} /> },
    { key: 'id', label: 'Receipt', render: (val: string) => (
      <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(val)}>
        <Download className="h-4 w-4 mr-1 text-primary" /> PDF
      </Button>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Billing & Invoicing" 
        description="GST compliant invoices with CGST/SGST split, multi-mode payments, and daily cash register settlement." 
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="create">Create Bill</TabsTrigger>
          <TabsTrigger value="list">All Bills</TabsTrigger>
          <TabsTrigger value="register">Daily Register</TabsTrigger>
        </TabsList>
        
        {/* Create Bill Tab */}
        <TabsContent value="create" className="pt-4">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Bill Details & Items</CardTitle>
              </CardHeader>
              <CardContent>
                <form id="billing-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  {/* Patient Selection */}
                  <div className="space-y-3">
                    <Label>Patient Selection *</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search patient by mobile number or name..." 
                        className="pl-8"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                      />
                    </div>
                    {patientSearch.length >= 2 && (
                      <div className="max-h-48 overflow-y-auto border rounded-md absolute z-10 bg-background w-full max-w-md shadow-lg">
                        {searchingPatients && <div className="p-2 text-sm text-center">Searching patients...</div>}
                        {patients?.map((patient: Patient) => (
                          <div 
                            key={patient.id} 
                            className="p-2.5 border-b cursor-pointer hover:bg-muted transition-colors flex justify-between items-center"
                            onClick={() => {
                              form.setValue('patientId', patient.id);
                              setPatientSearch('');
                            }}
                          >
                            <div>
                              <span className="font-medium block">{patient.firstName} {patient.lastName}</span>
                              <span className="text-xs text-muted-foreground">ID: {patient.patientCode} • Mobile: {patient.mobile}</span>
                            </div>
                            <Button size="sm" variant="ghost">Select</Button>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedPatient && (
                      <div className="p-3 bg-muted/60 rounded-md flex justify-between items-center border">
                        <div>
                          <span className="font-semibold block">{selectedPatient.firstName} {selectedPatient.lastName}</span>
                          <span className="text-xs text-muted-foreground">Patient Code: {selectedPatient.patientCode} • Mobile: {selectedPatient.mobile}</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => form.setValue('patientId', '')}>Change Patient</Button>
                      </div>
                    )}
                    {form.formState.errors.patientId && <p className="text-xs text-destructive">Please select a patient to bill.</p>}
                  </div>

                  {/* Line Items */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label>Items / Services</Label>
                      <div className="flex gap-2">
                        <Select onValueChange={(val) => {
                          const item = inventoryData?.data?.find((i: any) => i.id === val);
                          if (item) {
                            append({ description: `${item.name} (${item.code})`, quantity: 1, unitPrice: item.unitPrice });
                          } else if (val === 'consult') {
                            append({ description: 'General OPD Consultation Fee', quantity: 1, unitPrice: 500 });
                          } else if (val === 'followup') {
                            append({ description: 'Follow-up Consultation', quantity: 1, unitPrice: 300 });
                          } else if (val === 'lab_cbc') {
                            append({ description: 'Complete Blood Count (CBC)', quantity: 1, unitPrice: 350 });
                          } else if (val === 'lab_sugar') {
                            append({ description: 'Fasting Blood Sugar Test', quantity: 1, unitPrice: 150 });
                          }
                        }}>
                          <SelectTrigger className="w-[190px] h-9">
                            <ShoppingCart className="w-4 h-4 mr-2 text-primary" />
                            <SelectValue placeholder="Add Service / Drug" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="consult">OPD Consultation (₹500)</SelectItem>
                            <SelectItem value="followup">Follow-up Visit (₹300)</SelectItem>
                            <SelectItem value="lab_cbc">CBC Blood Test (₹350)</SelectItem>
                            <SelectItem value="lab_sugar">Blood Sugar Test (₹150)</SelectItem>
                            {inventoryData?.data?.map((item: any) => (
                              <SelectItem key={item.id} value={item.id}>{item.name} (₹{item.unitPrice})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}>
                          <Plus className="h-4 w-4 mr-1" /> Custom Line
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-3 border rounded-md p-3">
                      {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-3 items-start">
                          <div className="flex-1 space-y-1">
                            <Input placeholder="Description (Service or Medicine)" {...form.register(`items.${index}.description` as const)} />
                            {form.formState.errors.items?.[index]?.description && <p className="text-xs text-destructive">Required</p>}
                          </div>
                          <div className="w-20 space-y-1">
                            <Input type="number" min="1" placeholder="Qty" {...form.register(`items.${index}.quantity` as const, { valueAsNumber: true })} />
                          </div>
                          <div className="w-32 space-y-1">
                            <Input type="number" step="0.01" placeholder="Price" {...form.register(`items.${index}.unitPrice` as const, { valueAsNumber: true })} />
                          </div>
                          <div className="w-24 pt-2 font-medium text-right font-mono">
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
                      <Input type="number" min="0" step="1" {...form.register('discount', { valueAsNumber: true })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Mode</Label>
                      <Select onValueChange={(value) => form.setValue('paymentMode', value as any)} defaultValue={form.getValues('paymentMode')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CASH">Cash Counter</SelectItem>
                          <SelectItem value="UPI">UPI / QR Code</SelectItem>
                          <SelectItem value="CARD">Debit / Credit Card</SelectItem>
                          <SelectItem value="NET_BANKING">Net Banking</SelectItem>
                          <SelectItem value="ONLINE">Online Payment (Razorpay)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Summary & Tax Invoice Breakdown */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" /> Tax Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal ({fields.length} item{fields.length !== 1 ? 's' : ''})</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount</span>
                    <span className="font-mono">- ₹{Number(discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Taxable Value</span>
                  <span className="font-mono">₹{taxableAmount.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>CGST (9.0%)</span>
                    <span className="font-mono text-foreground">₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SGST (9.0%)</span>
                    <span className="font-mono text-foreground">₹{sgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-foreground">
                    <span>Total GST (18%)</span>
                    <span className="font-mono">₹{gstAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t pt-3 flex justify-between items-baseline">
                  <span className="text-base font-bold">Grand Total</span>
                  <span className="text-2xl font-bold text-primary font-mono">₹{total.toFixed(2)}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    type="submit" 
                    form="billing-form" 
                    className="w-full" 
                    size="lg"
                    disabled={isCreating || !selectedPatientId}
                  >
                    {isCreating ? 'Generating Invoice...' : 'Settle Bill & Print Invoice'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  HSN/SAC 9993. Instant SMS notification sent to patient upon settlement.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* All Bills Tab */}
        <TabsContent value="list" className="pt-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle>Invoices & Payment Records</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={billsData?.data || []}
                isLoading={loadingBills}
                page={page}
                pageSize={10}
                total={billsData?.total || 0}
                onPageChange={setPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Register / Shift Closing Tab */}
        <TabsContent value="register" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" /> Daily Cash Register & Shift Settlement
                </CardTitle>
                <p className="text-xs text-muted-foreground">Aggregated collections by payment channel and GST reconciliation for shift handover.</p>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={registerDate}
                  onChange={(e) => setRegisterDate(e.target.value)}
                  className="w-40"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Daily KPI summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-xs text-muted-foreground uppercase">Total Daily Revenue</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">₹{(registerData?.totalRevenue || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{registerData?.paidBills || 0} Paid Invoices</div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-xs text-muted-foreground uppercase">GST Collected</div>
                  <div className="text-2xl font-bold text-foreground mt-1">₹{(registerData?.totalGST || 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Split 50% CGST / 50% SGST</div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-xs text-muted-foreground uppercase">Cash in Drawer</div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">
                    ₹{(registerData?.byPaymentMode?.CASH || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Physical currency collected</div>
                </div>

                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-xs text-muted-foreground uppercase">Digital Payments (UPI/Card)</div>
                  <div className="text-2xl font-bold text-primary mt-1">
                    ₹{(
                      (registerData?.byPaymentMode?.UPI || 0) + 
                      (registerData?.byPaymentMode?.CARD || 0) + 
                      (registerData?.byPaymentMode?.ONLINE || 0)
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Bank direct settlement</div>
                </div>
              </div>

              {/* Payment Mode Breakdown */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3">Collection by Payment Mode</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['CASH', 'UPI', 'CARD', 'NET_BANKING', 'ONLINE'].map((mode) => (
                    <div key={mode} className="p-3 border rounded bg-muted/30">
                      <div className="text-xs font-semibold text-muted-foreground">{mode}</div>
                      <div className="text-lg font-bold font-mono mt-1">
                        ₹{(registerData?.byPaymentMode?.[mode] || 0).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Day's transactions list */}
              <div>
                <h4 className="font-semibold text-sm mb-3">Invoices Settled on {registerDate}</h4>
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                      <tr>
                        <th className="p-2.5 text-left">Bill Number</th>
                        <th className="p-2.5 text-left">Category</th>
                        <th className="p-2.5 text-left">Mode</th>
                        <th className="p-2.5 text-right">GST</th>
                        <th className="p-2.5 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registerData?.breakdown && registerData.breakdown.length > 0 ? (
                        registerData.breakdown.map((b: any, i: number) => (
                          <tr key={i} className="border-b">
                            <td className="p-2.5 font-mono font-medium">{b.billNumber}</td>
                            <td className="p-2.5 capitalize">{b.billType}</td>
                            <td className="p-2.5 font-semibold text-xs">{b.mode}</td>
                            <td className="p-2.5 text-right font-mono">₹{b.gst.toFixed(2)}</td>
                            <td className="p-2.5 text-right font-mono font-bold">₹{b.total.toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="text-center p-6 text-muted-foreground">
                            No billing activity recorded for {registerDate}.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
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
