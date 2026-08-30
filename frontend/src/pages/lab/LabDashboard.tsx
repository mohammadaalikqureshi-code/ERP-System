import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useLabOrders, useSubmitResult, useLabCatalog, useCreateOrder } from '@/api/lab';
import { usePatients } from '@/api/patients';
import { useDoctors } from '@/api/doctors';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { downloadFile } from '@/lib/download';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, FlaskConical, CheckCircle, Search, AlertTriangle, AlertCircle, Download, Plus, Check } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LabOrder } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function LabDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  
  const { toast } = useToast();
  const { data: orders, isLoading, refetch } = useLabOrders({ search: searchTerm });
  const submitResultMutation = useSubmitResult();

  const handleOpenResults = (order: LabOrder) => {
    setSelectedOrder(order);
    setIsResultModalOpen(true);
  };

  const handleDownloadPdf = async (orderId: string) => {
    try {
      await downloadFile(`/lab/orders/${orderId}/pdf`, `lab-report-${orderId.substring(0, 8)}.pdf`);
      toast({ title: 'Lab Report Downloaded' });
    } catch (error: any) {
      toast({
        title: 'Could not download lab report',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.patient?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.patient?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      order.patient?.patientCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.id.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'pending') return order.status !== 'completed';
    if (activeTab === 'completed') return order.status === 'completed';
    if (activeTab === 'abnormal') return (order as any).hasAbnormal || (order as any).hasCritical;
    return true;
  });

  const pendingCount = orders?.filter(o => o.status !== 'completed').length || 0;
  const abnormalCount = orders?.filter(o => (o as any).hasAbnormal || (o as any).hasCritical).length || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Diagnostic Laboratory" 
          description="Process lab test requests, record measured values with auto-reference ranges, and generate diagnostic reports."
        />
        <Button 
          onClick={() => setIsNewOrderModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-1.5 shadow-sm self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Walk-in Lab Order</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => setActiveTab('all')}>
          <CardHeader className="py-3 pb-1"><CardTitle className="text-xs text-muted-foreground uppercase">Total Orders</CardTitle></CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold">{orders?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">All diagnostic requests</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${pendingCount > 0 ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-amber-600 uppercase">Pending Results</CardTitle>
            <FlaskConical className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting technician entry</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${abnormalCount > 0 ? 'border-destructive/50 bg-destructive/5' : ''}`}
          onClick={() => setActiveTab('abnormal')}
        >
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-destructive uppercase">Abnormal / Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold text-destructive">{abnormalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Values outside normal range</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => setActiveTab('completed')}>
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground uppercase">Completed Reports</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold text-emerald-600">{(orders?.length || 0) - pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Verified and released</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Orders</TabsTrigger>
                <TabsTrigger value="pending">Pending ({pendingCount})</TabsTrigger>
                <TabsTrigger value="abnormal">Abnormal / Critical ({abnormalCount})</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search patient or Order ID..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Tests / Flag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No lab orders found in this category
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders?.map((order: any) => (
                      <TableRow key={order.id} className={order.hasCritical ? 'bg-rose-50/50' : order.hasAbnormal ? 'bg-amber-50/40' : ''}>
                        <TableCell className="font-medium font-mono text-xs">
                          {order.id.substring(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(order.orderDate).toLocaleDateString()} {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{order.patient?.firstName} {order.patient?.lastName}</div>
                          <div className="text-xs text-muted-foreground">{order.patient?.patientCode} • {order.patient?.mobile}</div>
                        </TableCell>
                        <TableCell className="text-sm">Dr. {order.doctor?.lastName}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-xs font-medium">{order.items?.length || 0} Test(s)</div>
                            {order.hasCritical && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-destructive text-destructive-foreground">
                                <AlertCircle className="h-3 w-3" /> CRITICAL
                              </span>
                            )}
                            {!order.hasCritical && order.hasAbnormal && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                                <AlertTriangle className="h-3 w-3" /> Out of Range
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            {order.status === 'completed' ? (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleOpenResults(order)}
                                  className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 cursor-pointer"
                                >
                                  <FlaskConical className="mr-1 h-3.5 w-3.5" />
                                  Edit / View Values
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(order.id)}>
                                  <Download className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                  Report PDF
                                </Button>
                              </>
                            ) : (
                              <Button 
                                size="sm" 
                                onClick={() => handleOpenResults(order)}
                                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs gap-1 cursor-pointer"
                              >
                                <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
                                Enter Values
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Entry / Edit Modal */}
      {selectedOrder && (
        <ResultEntryModal
          order={selectedOrder}
          isOpen={isResultModalOpen}
          onClose={() => {
            setIsResultModalOpen(false);
            setTimeout(() => setSelectedOrder(null), 200);
          }}
          onSubmit={(items) => {
            submitResultMutation.mutate({ orderId: selectedOrder.id, items }, {
              onSuccess: () => {
                toast({ title: 'Lab results saved and verified. Doctor & Patient notified.' });
                setIsResultModalOpen(false);
                refetch();
              },
              onError: () => {
                toast({ title: 'Failed to submit results', variant: 'destructive' });
              }
            });
          }}
          isSubmitting={submitResultMutation.isPending}
        />
      )}

      {/* New Walk-in Lab Order Modal */}
      {isNewOrderModalOpen && (
        <NewLabOrderModal
          isOpen={isNewOrderModalOpen}
          onClose={() => setIsNewOrderModalOpen(false)}
          onSuccess={() => {
            setIsNewOrderModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// 🧪 DEFAULT CLINICAL BASELINES LOOKUP FOR FAST LAB TECH FILLING
// =========================================================================
const DEFAULT_BASELINE_VALUES: Record<string, { value: string; unit: string; range: string }> = {
  "Complete Blood Count (CBC)": { value: "Normal Study", unit: "panel", range: "Normal Study" },
  "Haemoglobin (Hb)": { value: "14.2", unit: "g/dL", range: "13.0 - 17.0" },
  "Total Leukocyte Count (TLC)": { value: "7200", unit: "cells/µL", range: "4000 - 11000" },
  "Platelet Count": { value: "260000", unit: "cells/µL", range: "150000 - 450000" },
  "Packed Cell Volume (PCV)": { value: "45", unit: "%", range: "40 - 50" },
  "Mean Corpuscular Volume (MCV)": { value: "88", unit: "fL", range: "80 - 100" },
  "ESR": { value: "8", unit: "mm/hr", range: "0 - 15" },
  "Peripheral Blood Smear": { value: "Normocytic normochromic", unit: "report", range: "Normal study" },
  "Fasting Blood Sugar (FBS)": { value: "86", unit: "mg/dL", range: "70 - 100" },
  "Post Prandial Blood Sugar (PPBS)": { value: "115", unit: "mg/dL", range: "70 - 140" },
  "HbA1c (Glycated Haemoglobin)": { value: "5.2", unit: "%", range: "4.0 - 5.6" },
  "Serum Creatinine": { value: "0.9", unit: "mg/dL", range: "0.7 - 1.3" },
  "Blood Urea": { value: "24", unit: "mg/dL", range: "15 - 40" },
  "Uric Acid": { value: "4.8", unit: "mg/dL", range: "3.5 - 7.2" },
  "Total Cholesterol": { value: "165", unit: "mg/dL", range: "125 - 200" },
  "Triglycerides": { value: "115", unit: "mg/dL", range: "50 - 150" },
  "HDL Cholesterol": { value: "52", unit: "mg/dL", range: "40 - 60" },
  "LDL Cholesterol": { value: "85", unit: "mg/dL", range: "50 - 100" },
  "SGPT (ALT)": { value: "28", unit: "U/L", range: "7 - 56" },
  "SGOT (AST)": { value: "24", unit: "U/L", range: "8 - 48" },
  "Serum Bilirubin (Total)": { value: "0.7", unit: "mg/dL", range: "0.3 - 1.2" },
  "Alkaline Phosphatase (ALP)": { value: "92", unit: "U/L", range: "44 - 147" },
  "Total Protein": { value: "7.2", unit: "g/dL", range: "6.0 - 8.3" },
  "Serum Albumin": { value: "4.2", unit: "g/dL", range: "3.5 - 5.5" },
  "Serum Sodium": { value: "140", unit: "mEq/L", range: "135 - 145" },
  "Serum Potassium": { value: "4.2", unit: "mEq/L", range: "3.5 - 5.1" },
  "Serum Calcium": { value: "9.2", unit: "mg/dL", range: "8.5 - 10.2" },
  "TSH (Thyroid Stimulating Hormone)": { value: "2.1", unit: "µIU/mL", range: "0.4 - 4.0" },
  "Free T3": { value: "3.1", unit: "pg/mL", range: "2.3 - 4.2" },
  "Free T4": { value: "1.2", unit: "ng/dL", range: "0.8 - 1.8" },
  "Vitamin D (25-OH)": { value: "48", unit: "ng/mL", range: "30 - 100" },
  "Vitamin B12": { value: "480", unit: "pg/mL", range: "200 - 900" },
  "C-Reactive Protein (CRP)": { value: "1.5", unit: "mg/L", range: "0 - 6" },
  "Dengue NS1 Antigen": { value: "Non-reactive", unit: "qualitative", range: "Non-reactive" },
  "Widal Test": { value: "Non-reactive", unit: "qualitative", range: "Non-reactive" },
  "Malaria Antigen": { value: "Not detected", unit: "qualitative", range: "Not detected" },
  "Urine Routine & Microscopy": { value: "Normal Study", unit: "report", range: "Normal study" },
  "MRI Brain (with / without contrast)": { value: "Normal brain parenchyma. No acute infarct or focal lesion.", unit: "scan", range: "Normal" },
  "HRCT Chest (High-Res Lung CT)": { value: "Clear lung fields bilaterally. No consolidation or mass.", unit: "scan", range: "Normal" },
  "CT Brain / Head Scan": { value: "No intracranial hemorrhage or mass effect.", unit: "scan", range: "Normal" },
  "USG Whole Abdomen & Pelvis": { value: "Normal liver, kidneys and spleen echotexture.", unit: "scan", range: "Normal" },
  "Chest X-Ray (PA View)": { value: "Normal CTR. Clear costophrenic angles.", unit: "xray", range: "Normal" },
  "12-Lead ECG (Electrocardiogram)": { value: "Normal Sinus Rhythm. Rate 76 bpm. No ST-T changes.", unit: "ecg", range: "Normal" },
  "2D Echocardiography (Echo)": { value: "Normal LV systolic function. LVEF 62%. No RWMA.", unit: "echo", range: "Normal" },
};

function getStatusFlag(val: string, min?: number, max?: number, rangeStr?: string) {
  if (!val || val.trim() === '') return null;
  const num = parseFloat(val);
  if (isNaN(num)) {
    const isQualAbnormal = val.toLowerCase().includes('positive') || val.toLowerCase().includes('reactive') || val.toLowerCase().includes('abnormal') || val.toLowerCase().includes('detected');
    return isQualAbnormal 
      ? { label: 'ABNORMAL', color: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold' } 
      : { label: 'NORMAL', color: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold' };
  }

  let lo = min;
  let hi = max;
  if ((lo === undefined || hi === undefined) && rangeStr) {
    const parts = rangeStr.split('-').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (parts.length === 2) {
      lo = parts[0];
      hi = parts[1];
    }
  }

  if (lo !== undefined && hi !== undefined) {
    if (num > hi * 1.5 || (lo > 0 && num < lo * 0.5)) {
      return { label: '🚨 CRITICAL', color: 'bg-red-600 text-white font-black animate-pulse' };
    }
    if (num > hi) {
      return { label: '▲ HIGH', color: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' };
    }
    if (num < lo) {
      return { label: '▼ LOW', color: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold' };
    }
    return { label: 'NORMAL', color: 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold' };
  }
  return { label: 'ENTERED', color: 'bg-stone-100 text-stone-700' };
}

function ResultEntryModal({ 
  order, 
  isOpen, 
  onClose, 
  onSubmit, 
  isSubmitting 
}: { 
  order: any, 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (items: any) => void,
  isSubmitting: boolean
}) {
  const [overallImpression, setOverallImpression] = useState(order.notes || '');

  const { register, handleSubmit, control, watch, setValue } = useForm({
    defaultValues: {
      items: order.items?.map((item: any) => ({
        id: item.id,
        labTestId: item.labTestId,
        testName: item.test?.name || item.testName,
        resultValue: item.resultValue || '',
        isAbnormal: item.isAbnormal || false,
        remarks: item.remarks || '',
        normalRange: item.test?.normalRange || item.normalRange || '-',
        unit: item.test?.unit || item.unit || '',
        referenceRangeMin: item.test?.referenceRangeMin,
        referenceRangeMax: item.test?.referenceRangeMax,
      })) || []
    }
  });

  const { fields } = useFieldArray({
    control,
    name: "items"
  });

  const watchedItems = watch("items");

  const handleAutoFillBaselines = () => {
    fields.forEach((field: any, index: number) => {
      const match = DEFAULT_BASELINE_VALUES[field.testName] || 
        Object.entries(DEFAULT_BASELINE_VALUES).find(([k]) => field.testName.toLowerCase().includes(k.toLowerCase()))?.[1];
      if (match && (!watchedItems[index]?.resultValue || watchedItems[index]?.resultValue.trim() === '')) {
        setValue(`items.${index}.resultValue`, match.value, { shouldDirty: true });
        if (!watchedItems[index]?.remarks) {
          setValue(`items.${index}.remarks`, 'Within normal biological limits', { shouldDirty: true });
        }
      }
    });
  };

  const onSubmitForm = (data: any) => {
    onSubmit(data.items);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-teal-600" />
                <span>Pathology & Diagnostic Result Entry</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500 mt-1">
                Order ID: <strong>{order.id.substring(0, 8).toUpperCase()}</strong> • Patient: <strong>{order.patient?.firstName} {order.patient?.lastName}</strong> ({order.patient?.patientCode || 'PT-OPD'}) • Ref by: <strong>Dr. {order.doctor?.lastName || 'OPD'}</strong>
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutoFillBaselines}
              className="h-8 text-xs font-bold gap-1.5 border-teal-600 text-teal-700 hover:bg-teal-50 shrink-0 cursor-pointer shadow-xs"
            >
              <span>⚡ Auto-Fill Normal Baselines</span>
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 mt-3">
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-stone-50 dark:bg-stone-900">
                <TableRow>
                  <TableHead className="font-bold text-xs">Diagnostic Investigation</TableHead>
                  <TableHead className="w-[190px] font-bold text-xs">Observed Value</TableHead>
                  <TableHead className="font-bold text-xs">Unit</TableHead>
                  <TableHead className="font-bold text-xs">Reference Interval</TableHead>
                  <TableHead className="w-[120px] font-bold text-xs text-center">Live Flag</TableHead>
                  <TableHead className="font-bold text-xs">Clinical Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field: any, index) => {
                  const currentValue = watchedItems?.[index]?.resultValue || '';
                  const rangeStr = field.normalRange || (field.referenceRangeMin !== undefined ? `${field.referenceRangeMin} - ${field.referenceRangeMax}` : '');
                  const flag = getStatusFlag(currentValue, field.referenceRangeMin, field.referenceRangeMax, rangeStr);

                  return (
                    <TableRow key={field.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-900/60 transition-colors">
                      <TableCell className="font-bold text-xs text-stone-900 dark:text-stone-100">
                        <div>{field.testName}</div>
                      </TableCell>
                      <TableCell>
                        <Input 
                          placeholder="Enter measured value" 
                          className="h-8 text-xs font-bold bg-white dark:bg-stone-950 font-mono"
                          {...register(`items.${index}.resultValue`, { required: true })} 
                        />
                      </TableCell>
                      <TableCell className="text-xs font-mono text-stone-600 dark:text-stone-400">
                        {field.unit || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-stone-600 dark:text-stone-400 font-mono">
                        {rangeStr || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {flag ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] tracking-wide ${flag.color}`}>
                            {flag.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input 
                          placeholder="e.g. Normal morphology" 
                          className="h-8 text-xs bg-white dark:bg-stone-950"
                          {...register(`items.${index}.remarks`)} 
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pathologist Overall Impression & Clinical Notes */}
          <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <span>📝</span>
                <span>Pathologist / Radiologist Final Impression & Clinical Remarks</span>
              </span>
              <span className="text-[10px] text-stone-500 font-medium">Prints on Certified Report PDF</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pb-1">
              <span className="text-[10px] font-bold text-stone-400 self-center">Quick Impression Presets:</span>
              {[
                "All parameters within biological reference intervals.",
                "Mild microcytic hypochromic picture; advise iron profile.",
                "Normal anatomical study without focal mass or acute lesion.",
                "Elevated transaminases; advise clinical correlation and monitoring.",
                "Adequate platelet count and normal leukocyte morphology."
              ].map((imp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setOverallImpression(imp)}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:border-teal-400 text-stone-700 dark:text-stone-300 font-medium cursor-pointer"
                >
                  + {imp}
                </button>
              ))}
            </div>

            <Input
              value={overallImpression}
              onChange={(e) => setOverallImpression(e.target.value)}
              placeholder="e.g. Test results correlate with clinical history. All other hematological and biochemical parameters within normal biological limits."
              className="text-xs font-medium bg-white dark:bg-stone-950"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 italic">
            <span>* System automatically generates QR Code, Hospital Verification Header & Digital Signatures on report save.</span>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs font-semibold">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting} 
              className="h-9 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-md cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              <span>Verify & Release Certified Report</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewLabOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: patientsData } = usePatients({ limit: 50 });
  const { data: doctors = [] } = useDoctors();
  const { data: catalog = [] } = useLabCatalog();
  const createOrderMutation = useCreateOrder();
  const { toast } = useToast();

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [testSearch, setTestSearch] = useState('');

  const patients = (patientsData as any)?.items || (patientsData as any)?.data || (Array.isArray(patientsData) ? patientsData : []);

  const toggleTest = (testId: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      toast({ title: 'Please select a patient', variant: 'destructive' });
      return;
    }
    if (selectedTestIds.length === 0) {
      toast({ title: 'Please select at least one test to order', variant: 'destructive' });
      return;
    }

    const docId = selectedDoctorId || (doctors[0] as any)?.id;

    try {
      await createOrderMutation.mutateAsync({
        patientId: selectedPatientId as any,
        doctorId: docId as any,
        tests: selectedTestIds as any,
        status: 'pending',
      });
      toast({ title: 'New Lab Order Created! 🧪', description: 'Patient is ready for test sample & results entry.', variant: 'success' });
      onSuccess();
    } catch (err: any) {
      toast({ title: 'Failed to create order', description: err.response?.data?.message || err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
            <Plus className="w-5 h-5 text-teal-600" />
            <span>Create New Walk-in Lab / Scan Order</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-stone-500">
            Order blood tests, diagnostic panels, or scans for walk-in or referred patients.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateOrder} className="space-y-4 mt-3">
          {/* Patient Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-stone-800 dark:text-stone-200">1. Select Patient *</Label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              required
              className="w-full h-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 text-xs font-medium focus:border-teal-500"
            >
              <option value="">-- Choose Registered Patient --</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.firstName || p.first_name} {p.lastName || p.last_name} ({p.patientCode || p.patient_code || 'PT'}) • {p.mobile || 'No Mobile'}
                </option>
              ))}
            </select>
          </div>

          {/* Referring Doctor Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-stone-800 dark:text-stone-200">2. Referring Doctor (Optional)</Label>
            <select
              value={selectedDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="w-full h-9 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 text-xs font-medium focus:border-teal-500"
            >
              <option value="">-- OPD General Walk-in / Self --</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name || d.user?.fullName || d.user?.full_name || `${d.firstName || ''} ${d.lastName || ''}`} ({d.specialization || d.department || 'Doctor'})
                </option>
              ))}
            </select>
          </div>

          {/* Select Tests from Catalog */}
          <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-stone-800 dark:text-stone-200">
                3. Select Diagnostic Tests & Scans * ({selectedTestIds.length} Selected)
              </Label>
              <span className="text-[11px] text-teal-600 font-bold">
                {catalog.length} Tests in Catalog
              </span>
            </div>

            <Input
              value={testSearch}
              onChange={(e) => setTestSearch(e.target.value)}
              placeholder="Search test name (e.g. CBC, Creatinine, Lipid, MRI, USG)..."
              className="h-8 text-xs bg-white dark:bg-stone-950 border-stone-300 dark:border-stone-700"
            />

            <div className="max-h-52 overflow-y-auto border border-stone-200 dark:border-stone-800 rounded-xl p-2 divide-y divide-stone-100 dark:divide-stone-800 bg-stone-50/40 dark:bg-stone-900/40">
              {catalog
                .filter((t: any) => !testSearch || (t.testName || t.name || '').toLowerCase().includes(testSearch.toLowerCase()) || (t.category || '').toLowerCase().includes(testSearch.toLowerCase()))
                .map((test: any) => {
                  const id = test.id;
                  const name = test.testName || test.name;
                  const isChecked = selectedTestIds.includes(id);
                  return (
                    <div
                      key={id}
                      onClick={() => toggleTest(id)}
                      className={`p-2 text-xs flex items-center justify-between rounded-lg cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-teal-100 dark:bg-teal-950 text-teal-950 dark:text-teal-100 font-bold'
                          : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isChecked ? 'bg-teal-600 text-white border-teal-600' : 'border-stone-400 bg-white dark:bg-stone-900'
                        }`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </span>
                        <span>{name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-normal">
                          {test.category || 'General'}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-stone-600 dark:text-stone-300">
                        ₹{test.price || 150}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 text-xs font-semibold">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="h-9 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-md cursor-pointer"
            >
              {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              <span>Create Order & Ready for Testing</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
