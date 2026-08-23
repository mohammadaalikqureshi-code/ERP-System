import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { inventoryItemSchema, inventoryTransactionSchema } from '@/lib/validations';
import { 
  useInventory, 
  useCreateItem, 
  useUpdateItem, 
  useAddTransaction, 
  useExpiringItems, 
  useLowStockItems,
  usePurchaseOrders,
  useGeneratePurchaseOrder,
  InventoryItem 
} from '@/api/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { useToast } from '@/components/ui/use-toast';
import { 
  Search, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, 
  PackageSearch, Clock, ShoppingBag, ShieldAlert, FileText, Loader2, Sparkles 
} from 'lucide-react';
import { z } from 'zod';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

type ItemFormValues = z.infer<typeof inventoryItemSchema> & {
  batchNumber?: string;
  manufactureDate?: string;
  expiryDate?: string;
  supplierName?: string;
  hsnCode?: string;
};

type TransactionFormValues = z.infer<typeof inventoryTransactionSchema>;

const InventoryDashboardContent = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('ALL');

  const { data: inventoryData, isLoading } = useInventory({
    page,
    pageSize: 10,
    search: search.length > 2 ? search : undefined,
    category: category !== 'ALL' ? category : undefined,
  });

  const { data: expiringItems, isLoading: loadingExpiring } = useExpiringItems(90);
  const { data: lowStockItems, isLoading: loadingLowStock } = useLowStockItems();
  const { data: purchaseOrders, isLoading: loadingPO } = usePurchaseOrders();

  const { mutateAsync: createItem } = useCreateItem();
  const { mutateAsync: updateItem } = useUpdateItem();
  const { mutateAsync: addTransaction } = useAddTransaction();
  const { mutateAsync: generatePO, isPending: isGeneratingPO } = useGeneratePurchaseOrder();

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // PO View Modal State
  const [selectedPO, setSelectedPO] = useState<any | null>(null);

  const itemForm = useForm<ItemFormValues>({
    resolver: zodResolver(inventoryItemSchema) as any,
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

  const openItemModal = (item?: any) => {
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
        batchNumber: item.batchNumber || '',
        supplierName: item.supplierName || item.manufacturer || '',
        hsnCode: item.hsnCode || '',
        expiryDate: item.expiryDate ? item.expiryDate.split('T')[0] : '',
      });
    } else {
      setEditingItem(null);
      itemForm.reset({
        code: '', name: '', category: 'MEDICINE', unit: '', currentStock: 0, minimumStock: 0, unitPrice: 0, 
        manufacturer: '', notes: '', batchNumber: '', supplierName: '', hsnCode: '', expiryDate: ''
      });
    }
    setIsItemModalOpen(true);
  };

  const onItemSubmit = async (data: any) => {
    try {
      if (editingItem) {
        await updateItem({ id: editingItem.id, data });
        toast({ title: 'Item updated successfully' });
      } else {
        await createItem(data);
        toast({ title: 'Item created successfully' });
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
      toast({ title: 'Transaction saved successfully' });
      setIsTxModalOpen(false);
    } catch (error: any) {
      toast({ title: 'Error saving transaction', description: error.response?.data?.message || error.message, variant: 'destructive' });
    }
  };

  const handleGeneratePO = async () => {
    try {
      const res = await generatePO('Auto-Vendor Supply');
      toast({ 
        title: 'Purchase Order Created', 
        description: `PO #${res.poNumber || res.id} generated with ${res.items?.length || 0} items for ₹${res.totalAmount || 0}` 
      });
      setActiveTab('po');
    } catch (err: any) {
      toast({ title: 'Failed to generate PO', description: err.message, variant: 'destructive' });
    }
  };

  const getExpiryBadge = (status?: string, days?: number) => {
    if (!status || days === undefined) return null;
    if (status === 'EXPIRED') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300">EXPIRED</span>;
    }
    if (status === 'CRITICAL' || days <= 30) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">Expires in {days}d</span>;
    }
    if (status === 'WARNING' || days <= 60) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Expires in {days}d</span>;
    }
    if (status === 'APPROACHING' || days <= 90) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">{days}d remaining</span>;
    }
    return <span className="text-xs text-muted-foreground">{days}d</span>;
  };

  const columns = [
    { key: 'code', label: 'Code', render: (val: string) => <span className="font-mono text-xs font-semibold">{val}</span> },
    { key: 'name', label: 'Name', render: (val: string, row: any) => (
      <div>
        <div className="font-medium flex items-center gap-2">
          {val}
          {row.batchNumber && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-secondary rounded text-secondary-foreground">
              Batch: {row.batchNumber}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex gap-2">
          <span>{row.category}</span>
          {row.genericName && <span>• {row.genericName}</span>}
          {row.hsnCode && <span>• HSN: {row.hsnCode}</span>}
        </div>
      </div>
    ) },
    { key: 'currentStock', label: 'Stock', render: (val: number, row: any) => {
      const isLow = val <= row.minimumStock;
      return (
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${isLow ? 'text-destructive font-bold' : ''}`}>{val} {row.unit}</span>
          {isLow && <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" title={`Below min ${row.minimumStock}`} />}
        </div>
      );
    } },
    { key: 'expiryStatus', label: 'Expiry', render: (_val: string, row: any) => (
      <div>
        {getExpiryBadge(row.expiryStatus, row.daysToExpiry)}
        {row.expiryDate && (
          <div className="text-[11px] text-muted-foreground">{new Date(row.expiryDate).toLocaleDateString()}</div>
        )}
      </div>
    ) },
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
        <PageHeader 
          title="Pharmacy & Inventory" 
          description="Batch tracking, expiry alerts, stock movements, and automatic purchase orders." 
        />
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            onClick={handleGeneratePO} 
            disabled={isGeneratingPO || (lowStockItems && lowStockItems.length === 0)}
            className="gap-2"
          >
            {isGeneratingPO ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
            Auto-Order Low Stock ({lowStockItems?.length || 0})
          </Button>
          <Button onClick={() => openItemModal()}>
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => setActiveTab('all')}>
          <CardHeader className="py-3 pb-1"><CardTitle className="text-xs text-muted-foreground uppercase">Total SKUs</CardTitle></CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold">{inventoryData?.total || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active inventory items</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${lowStockItems && lowStockItems.length > 0 ? 'border-destructive/50 bg-destructive/5' : ''}`}
          onClick={() => setActiveTab('low-stock')}
        >
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-destructive uppercase">Low Stock Alerts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold text-destructive">{lowStockItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Below reorder threshold</p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${expiringItems && expiringItems.length > 0 ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
          onClick={() => setActiveTab('expiring')}
        >
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-amber-600 uppercase">Expiring (90 Days)</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold text-amber-600">{expiringItems?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Batches nearing expiry</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-all" onClick={() => setActiveTab('po')}>
          <CardHeader className="py-3 pb-1 flex flex-row items-center justify-between">
            <CardTitle className="text-xs text-muted-foreground uppercase">Purchase Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="py-1">
            <div className="text-2xl font-bold">{purchaseOrders?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Supplier orders placed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="all">All Catalog</TabsTrigger>
          <TabsTrigger value="low-stock">
            Low Stock {lowStockItems && lowStockItems.length > 0 && `(${lowStockItems.length})`}
          </TabsTrigger>
          <TabsTrigger value="expiring">
            Expiring {expiringItems && expiringItems.length > 0 && `(${expiringItems.length})`}
          </TabsTrigger>
          <TabsTrigger value="po">Purchase Orders</TabsTrigger>
        </TabsList>

        {/* Tab 1: All Items */}
        <TabsContent value="all" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search medicines, batch numbers, supplies..." 
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
        </TabsContent>

        {/* Tab 2: Low Stock */}
        <TabsContent value="low-stock" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-destructive">Items Below Reorder Level</CardTitle>
                <p className="text-xs text-muted-foreground">These items require immediate restocking to prevent stock-outs.</p>
              </div>
              <Button onClick={handleGeneratePO} disabled={isGeneratingPO || !lowStockItems?.length} size="sm">
                <Sparkles className="h-4 w-4 mr-2" /> Auto-Create Purchase Order
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={lowStockItems || []}
                isLoading={loadingLowStock}
                page={1}
                pageSize={100}
                total={lowStockItems?.length || 0}
                emptyState={
                  <div className="text-center py-8 text-muted-foreground">
                    ✓ All inventory items are adequately stocked!
                  </div>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Expiring Soon */}
        <TabsContent value="expiring" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-amber-600">Medicines Expiring in Next 90 Days</CardTitle>
              <p className="text-xs text-muted-foreground">Prioritize dispensing these batches or contact suppliers for replacement.</p>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                data={expiringItems || []}
                isLoading={loadingExpiring}
                page={1}
                pageSize={100}
                total={expiringItems?.length || 0}
                emptyState={
                  <div className="text-center py-8 text-muted-foreground">
                    ✓ No medicines expiring in the next 90 days.
                  </div>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Purchase Orders */}
        <TabsContent value="po" className="space-y-4 pt-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Purchase Orders</CardTitle>
              <p className="text-xs text-muted-foreground">Orders generated for medicine and supply procurement.</p>
            </CardHeader>
            <CardContent>
              {loadingPO ? (
                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : purchaseOrders && purchaseOrders.length > 0 ? (
                <div className="space-y-4">
                  {purchaseOrders.map((po: any) => (
                    <div key={po.id} className="p-4 border rounded-lg flex items-center justify-between hover:bg-muted/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-sm">{po.poNumber || po.id.substring(0, 8)}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-semibold">
                            {po.status}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Supplier: <span className="font-medium text-foreground">{po.supplierName}</span> • Items: {po.items?.length || 0} • Created: {new Date(po.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className="font-bold text-base">₹{parseFloat(po.totalAmount || 0).toFixed(2)}</div>
                          <div className="text-[11px] text-muted-foreground">Total Value</div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPO(po)}>
                          <FileText className="h-4 w-4 mr-1" /> View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No purchase orders created yet. Click "Auto-Order Low Stock" to generate one.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Item Modal with Batch & Expiry fields */}
      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}</DialogTitle>
            <DialogDescription>Enter product details, pricing, batch number, and expiry date.</DialogDescription>
          </DialogHeader>
          <form id="item-form" onSubmit={itemForm.handleSubmit(onItemSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Item Code</Label>
                <Input {...itemForm.register('code')} placeholder="e.g. PAR-500" />
              </div>
              <div className="space-y-1">
                <Label>Item Name</Label>
                <Input {...itemForm.register('name')} placeholder="e.g. Paracetamol 500mg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
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
              <div className="space-y-1">
                <Label>Unit of Measure</Label>
                <Input {...itemForm.register('unit')} placeholder="e.g. Strips, Box, Bottle" />
              </div>
            </div>

            {/* Batch & Regulatory Fields */}
            <div className="border-t pt-3 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Batch & Tax Details</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Batch Number</Label>
                  <Input {...itemForm.register('batchNumber')} placeholder="BATCH-2026-A" />
                </div>
                <div className="space-y-1">
                  <Label>Expiry Date</Label>
                  <Input type="date" {...itemForm.register('expiryDate')} />
                </div>
                <div className="space-y-1">
                  <Label>HSN Code</Label>
                  <Input {...itemForm.register('hsnCode')} placeholder="300490" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Supplier / Manufacturer</Label>
                <Input {...itemForm.register('supplierName')} placeholder="e.g. Cipla Ltd / Sun Pharma" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase">Stock & Pricing</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Unit Price (₹)</Label>
                  <Input type="number" step="0.01" {...itemForm.register('unitPrice', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Current Stock</Label>
                  <Input type="number" disabled={!!editingItem} {...itemForm.register('currentStock', { valueAsNumber: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Min. Stock Level</Label>
                  <Input type="number" {...itemForm.register('minimumStock', { valueAsNumber: true })} />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit">Save Product</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock Transaction Modal */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{txForm.getValues('type') === 'IN' ? 'Add Stock (Inward)' : 'Reduce Stock (Outward)'}</DialogTitle>
            <DialogDescription>{txItem?.name} (Current: {txItem?.currentStock} {txItem?.unit})</DialogDescription>
          </DialogHeader>
          <form onSubmit={txForm.handleSubmit(onTxSubmit)} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input type="number" min="1" {...txForm.register('quantity', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1">
              <Label>Reference / Invoice No.</Label>
              <Input {...txForm.register('reference')} placeholder="e.g. SUP-INV-009" />
            </div>
            <div className="space-y-1">
              <Label>Notes / Remarks</Label>
              <Input {...txForm.register('notes')} placeholder="e.g. Monthly batch restock" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTxModalOpen(false)}>Cancel</Button>
              <Button type="submit">Record Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Purchase Order View Modal */}
      {selectedPO && (
        <Dialog open={!!selectedPO} onOpenChange={() => setSelectedPO(null)}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Purchase Order: {selectedPO.poNumber || selectedPO.id}</DialogTitle>
              <DialogDescription>
                Supplier: {selectedPO.supplierName} | Status: <span className="font-semibold text-primary">{selectedPO.status}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-2 text-left">Item Name</th>
                      <th className="p-2 text-right">Cur. Stock</th>
                      <th className="p-2 text-right">Order Qty</th>
                      <th className="p-2 text-right">Unit Price</th>
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPO.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2 text-right text-muted-foreground">{item.current_stock}</td>
                        <td className="p-2 text-right font-bold">{item.quantity}</td>
                        <td className="p-2 text-right">₹{item.unit_price}</td>
                        <td className="p-2 text-right font-semibold">₹{(item.total || item.quantity * item.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right text-lg font-bold">
                Grand Total: ₹{parseFloat(selectedPO.totalAmount || 0).toFixed(2)}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedPO(null)}>Close</Button>
              <Button onClick={() => {
                toast({ title: 'Purchase Order sent to supplier via Email/SMS' });
                setSelectedPO(null);
              }}>
                Dispatch PO to Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
