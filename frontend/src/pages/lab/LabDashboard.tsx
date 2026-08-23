import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useLabOrders, useSubmitResult } from '@/api/lab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Loader2, FileText, FlaskConical, CheckCircle, Search, AlertTriangle, AlertCircle, Download } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LabOrder } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function LabDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  
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
      <PageHeader 
        title="Diagnostic Laboratory" 
        description="Process lab test requests, record measured values with auto-reference ranges, and generate diagnostic reports."
      />

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
                          <div className="flex justify-end gap-2">
                            {order.status === 'completed' ? (
                              <Button variant="outline" size="sm" onClick={() => handleDownloadPdf(order.id)}>
                                <Download className="mr-1.5 h-3.5 w-3.5 text-primary" />
                                Report PDF
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => handleOpenResults(order)}>
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

      {/* Result Entry Modal */}
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
                toast({ title: 'Lab results saved and verified. Doctor notified.' });
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
    </div>
  );
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
  const { register, handleSubmit, control, watch } = useForm({
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

  const onSubmitForm = (data: any) => {
    onSubmit(data.items);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enter Lab Results</DialogTitle>
          <DialogDescription>
            Order ID: {order.id.substring(0, 8).toUpperCase()} | Patient: {order.patient?.firstName} {order.patient?.lastName} ({order.patient?.patientCode})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead className="w-[180px]">Observed Value</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Reference Range</TableHead>
                  <TableHead>Clinical Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field: any, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">
                      <div>{field.testName}</div>
                    </TableCell>
                    <TableCell>
                      <Input 
                        placeholder="e.g. 14.2" 
                        {...register(`items.${index}.resultValue`, { required: true })} 
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {field.unit || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {field.normalRange || (field.referenceRangeMin !== undefined ? `${field.referenceRangeMin} - ${field.referenceRangeMax}` : '—')}
                    </TableCell>
                    <TableCell>
                      <Input 
                        placeholder="Optional remarks" 
                        {...register(`items.${index}.remarks`)} 
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground italic">
            * The system will automatically compare observed values against reference ranges and flag high/low/critical results in the final report.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Save & Release Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
