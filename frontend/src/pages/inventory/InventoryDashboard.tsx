import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryItemSchema, inventoryTransactionSchema } from '@/lib/validations';
import { useInventory, useCreateItem, useUpdateItem, useAddTransaction, InventoryItem } from '@/api/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { Search, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, PackageSearch } from 'lucide-react';
import { z } from 'zod';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

type ItemFormValues = z.infer<typeof inventoryItemSchema>;
type TransactionFormValues = z.infer<typeof inventoryTransactionSchema>;

const InventoryDashboardContent = () => {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');

  const { data: inventoryData, isLoading } = useInventory({
    page,
    pageSize: 10,
    search: search.length > 2 ? search : undefined,
    category: category !== 'ALL' ? category : undefined,
  });

  const { mutateAsync: createItem, isPending: isCreating } = useCreateItem();
  const { mutateAsync: updateItem, isPending: isUpdating } = useUpdateItem();
  const { mutateAsync: addTransaction, isPending: isAddingTx } = useAddTransaction();

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      code: '',
      name: '',
      category: 'MEDICINE',
      unit: '',
      currentStock: 0,
      minimumStock: 0,
      unitPrice: 0,
    }
  });

  const openItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      itemForm.reset({
        code: item.code,
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: item.currentStock,
        minimumStock: item.minimumStock,
        unitPrice: item.unitPrice,
        manufacturer: item.manufacturer || '',
        notes: item.notes || '',
      });
    } else {
      setEditingItem(null);
      itemForm.reset({
        code: '', name: '', category: 'MEDICINE', unit: '', currentStock: 0, minimumStock: 0, unitPrice: 0, manufacturer: '', notes: ''
      });
    }
    setIsItemModalOpen(true);
  };

  const onItemSubmit = async (data: ItemFormValues) => {
    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data });
        toast({ title: 'Item updated successfully', variant: 'success' });
      } else {
        await createItem(data);
        toast({ title: 'Item created successfully', variant: 'success' });
      }
      setIsItemModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Error saving item', description: error.response?.data?.message || error.message, variant: 'destructive' });
    }
  };

  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txItem, setTxItem] = useState<InventoryItem | null>(null);

  const txForm = useForm<TransactionFormValues>({
    resolver: zodResolver(inventoryTransactionSchema),
    defaultValues: { type: 'IN', quantity: 1 }
  });

  const openTxModal = (item: InventoryItem, type: 'IN' | 'OUT') => {
    setTxItem(item);
    txForm.reset({ type, quantity: 1, reference: '', notes: '' });
    setIsTxModalOpen(true);
  };

  const onTxSubmit = async (data: TransactionFormValues) => {
    if (!txItem) return;
    try {
      await addTransaction({ itemId: txItem.id, transactionData: data });
      toast({ title: 'Transaction saved successfully', variant: 'success' });
      setIsTxModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Error saving transaction', description: error.response?.data?.message || error.message, variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'code', label: 'Code', render: (val: string) => <span className="font-mono text-xs font-semibold">{val}</span> },
    { key: 'name', label: 'Name', render: (val: string, row: any) => (
      <div>
        <div className="font-medium">{val}</div>
        <div className="text-xs text-muted-foreground">{row.category}</div>
      </div>
    ) },
    { key: 'currentStock', label: 'Stock', render: (val: number, row: any) => {
      const isLow = val <= row.minimumStock;
      return (
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isLow ? 'text-destructive' : ''}`}>{val} {row.unit}</span>
          {isLow && <AlertTriangle className="h-4 w-4 text-destructive" />}
        </div>
      );
    } },
    { key: 'unitPrice', label: 'Price', render: (val: number) => `₹${val.toFixed(2)}` },
    { key: 'id', label: 'Actions', render: (_val: string, row: any) => (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => openTxModal(row, 'IN')} title="Add Stock">
          <ArrowDownToLine className="h-4 w-4 text-emerald-500" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => openTxModal(row, 'OUT')} title="Reduce Stock">
          <ArrowUpFromLine className="h-4 w-4 text-orange-500" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => openItemModal(row)}>Edit</Button>
      </div>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader title="Inventory Management" description="Manage clinic medicines, supplies, and equipment." />
        <Button onClick={() => openItemModal()}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search items..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="MEDICINE">Medicines</SelectItem>
                  <SelectItem value="SUPPLY">Supplies</SelectItem>
                  <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={inventoryData?.data || []}
            isLoading={isLoading}
            page={page}
            pageSize={10}
            total={inventoryData?.total || 0}
            onPageChange={setPage}
            emptyState={
              <div className="text-center py-10">
                <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No items found</h3>
                <p className="text-muted-foreground">Adjust filters or add a new item.</p>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Item Modal */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          <form id="item-form" onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input {...itemForm.register('code')} placeholder="e.g. PAR500" />
                {itemForm.formState.errors.code && <p className="text-xs text-destructive">{itemForm.formState.errors.code.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...itemForm.register('name')} placeholder="e.g. Paracetamol 500mg" />
                {itemForm.formState.errors.name && <p className="text-xs text-destructive">{itemForm.formState.errors.name.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select onValueChange={(value) => itemForm.setValue('category', value as any)} defaultValue={itemForm.getValues('category')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEDICINE">Medicine</SelectItem>
                    <SelectItem value="SUPPLY">Supply</SelectItem>
                    <SelectItem value="EQUIPMENT">Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input {...itemForm.register('unit')} placeholder="e.g. Strips, Boxes, Pcs" />
                {itemForm.formState.errors.unit && <p className="text-xs text-destructive">{itemForm.formState.errors.unit.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input type="number" step="0.01" {...itemForm.register('unitPrice', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Initial Stock</Label>
                <Input type="number" disabled={!!editingItem} {...itemForm.register('currentStock', { valueAsNumber: true })} />
              </div>
              <div className="space-y-2">
                <Label>Min Stock Alert</Label>
                <Input type="number" {...itemForm.register('minimumStock', { valueAsNumber: true })} />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="item-form" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Saving...' : 'Save Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Modal */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{txForm.watch('type') === 'IN' ? 'Add Stock' : 'Reduce Stock'}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="font-medium">{txItem?.name}</p>
            <p className="text-sm text-muted-foreground">Current Stock: {txItem?.currentStock} {txItem?.unit}</p>
          </div>
          <form id="tx-form" onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Quantity to {txForm.watch('type') === 'IN' ? 'Add' : 'Remove'}</Label>
              <Input type="number" min="1" {...txForm.register('quantity', { valueAsNumber: true })} />
              {txForm.formState.errors.quantity && <p className="text-xs text-destructive">{txForm.formState.errors.quantity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Reference (Optional)</Label>
              <Input {...txForm.register('reference')} placeholder="Invoice / Prescription No." />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input {...txForm.register('notes')} placeholder="Reason..." />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTxModalOpen(false)}>Cancel</Button>
            <Button type="submit" form="tx-form" disabled={isAddingTx}>
              {isAddingTx ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function InventoryDashboard() {
  return (
    <ErrorBoundary>
      <InventoryDashboardContent />
    </ErrorBoundary>
  );
}
