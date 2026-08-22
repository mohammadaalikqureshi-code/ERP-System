import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useLabOrders, useSubmitResult } from '@/api/lab';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, FlaskConical, CheckCircle, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LabOrder } from '@/types';
import { StatusBadge } from '@/components/shared/StatusBadge';

export default function LabDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  
  const { toast } = useToast();
  const { data: orders, isLoading } = useLabOrders({ search: searchTerm });
  const submitResultMutation = useSubmitResult();

  const handleOpenResults = (order: LabOrder) => {
    setSelectedOrder(order);
    setIsResultModalOpen(true);
  };

  const filteredOrders = orders?.filter(order => 
    order.patient?.firstName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    order.patient?.patientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader 
        title="Laboratory Dashboard" 
        description="Manage lab orders and enter test results"
      />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle>Lab Orders</CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by patient name or ID..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                    <TableHead>Date</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No lab orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium text-xs">{order.id.substring(0, 8).toUpperCase()}</TableCell>
                        <TableCell>{new Date(order.orderDate).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="font-medium">{order.patient?.firstName} {order.patient?.lastName}</div>
                          <div className="text-xs text-muted-foreground">{order.patient?.patientCode}</div>
                        </TableCell>
                        <TableCell>Dr. {order.doctor?.lastName}</TableCell>
                        <TableCell>{order.items?.length || 0} tests</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {order.status === 'completed' ? (
                              <Button variant="outline" size="sm">
                                <FileText className="mr-2 h-4 w-4" />
                                Report
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => handleOpenResults(order)}>
                                <FlaskConical className="mr-2 h-4 w-4" />
                                Enter Results
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
                toast({ title: 'Results submitted successfully' });
                setIsResultModalOpen(false);
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
  order: LabOrder, 
  isOpen: boolean, 
  onClose: () => void, 
  onSubmit: (items: any) => void,
  isSubmitting: boolean
}) {
  const { register, handleSubmit, control } = useForm({
    defaultValues: {
      items: order.items?.map(item => ({
        id: item.id,
        labTestId: item.labTestId,
        testName: item.test?.name,
        resultValue: item.resultValue || '',
        isAbnormal: item.isAbnormal || false,
        remarks: item.remarks || '',
        normalRange: item.test?.normalRange,
        unit: item.test?.unit,
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
            Order ID: {order.id.substring(0, 8).toUpperCase()} | Patient: {order.patient?.firstName} {order.patient?.lastName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6 mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Result Value</TableHead>
                  <TableHead>Unit / Ref. Range</TableHead>
                  <TableHead className="w-[80px]">Abnormal</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field: any, index) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.testName}</TableCell>
                    <TableCell>
                      <Input 
                        placeholder="Enter value" 
                        {...register(`items.${index}.resultValue`, { required: true })} 
                      />
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{field.unit}</div>
                      <div className="text-muted-foreground text-xs">{field.normalRange}</div>
                    </TableCell>
                    <TableCell className="text-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 accent-red-500"
                        {...register(`items.${index}.isAbnormal`)} 
                      />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Submit Results
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
