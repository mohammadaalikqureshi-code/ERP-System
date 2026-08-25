import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { downloadFile } from '@/lib/download';
import api from '@/api/client';
import { 
  Search, FileText, FlaskConical, Pill, Receipt, Calendar, 
  Download, ArrowLeft, HeartPulse, User, Phone, CheckCircle2, 
  AlertTriangle, AlertCircle, Sparkles, Loader2, Hospital 
} from 'lucide-react';

export default function PatientReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any | null>(null);
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('lab');
  const { toast } = useToast();

  const handleSearch = async (searchTerm?: string) => {
    const q = (searchTerm !== undefined ? searchTerm : query).trim();
    if (!q || q.length < 2) {
      toast({ title: "Please enter a Serial No., Patient Code or Mobile Number", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    setSearched(true);
    setSearchParams({ q });

    try {
      const res = await api.get(`/public/patient-reports/search?query=${encodeURIComponent(q)}`);
      if (res.data.found) {
        setReportData(res.data);
        toast({ title: `Records found for ${res.data.patient.fullName}` });
      } else {
        setReportData(null);
        toast({ title: "No Records Found", description: res.data.message, variant: "destructive" });
      }
    } catch (err: any) {
      setReportData(null);
      toast({ 
        title: "Search Error", 
        description: err.response?.data?.message || err.message || "Failed to search reports", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
  }, []);

  const handleDownloadPdf = async (url: string, filename: string) => {
    try {
      await downloadFile(url, filename);
      toast({ title: "Report Downloaded Successfully" });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    }
  };

  const getFlagBadge = (flag: string, isAbnormal: boolean) => {
    if (flag === 'CRITICAL_HIGH' || flag === 'CRITICAL_LOW') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white">
          <AlertCircle className="h-3 w-3" /> CRITICAL
        </span>
      );
    }
    if (isAbnormal || flag === 'HIGH' || flag === 'LOW') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-3 w-3 text-amber-600" /> {flag || 'ABNORMAL'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="h-3 w-3 text-emerald-600" /> NORMAL
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 border-b bg-white dark:bg-stone-900 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-600 rounded-xl text-white shadow-md">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <span className="font-bold text-lg text-stone-900 dark:text-white">MediCare Patient Portal</span>
            <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 font-semibold">
              Public Reports
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/queue">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Hospital className="h-4 w-4" /> Live Queue Screen
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <User className="h-4 w-4" /> Staff Sign In
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Hero Search Card */}
        <Card className="border-teal-500/20 bg-gradient-to-br from-teal-900/10 via-background to-teal-950/10 shadow-lg">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center justify-center gap-2">
              <FileText className="h-7 w-7 text-teal-600" />
              Patient Medical Reports & Prescriptions
            </CardTitle>
            <CardDescription className="text-sm max-w-lg mx-auto">
              Access your Diagnostic Lab Results, Doctor Prescriptions, and GST Invoices instantly. No login or password required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-2xl mx-auto pb-6">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Enter Serial No. / Patient ID (e.g. PAT-2026-0001) or Mobile..."
                  className="pl-10 h-11 bg-background text-base"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isLoading} className="h-11 px-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Search
              </Button>
            </form>

            {/* Quick Demo Tags */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
              <span>Try sample IDs:</span>
              {['PAT-2026-0001', 'PAT-2026-0002', '9876543210'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => {
                    setQuery(sample);
                    handleSearch(sample);
                  }}
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 font-mono transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Patient Report Results */}
        {reportData && reportData.patient && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Patient Header Card */}
            <Card className="border-teal-500/30 bg-card shadow-md">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xl font-bold">
                      {reportData.patient.fullName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-foreground">{reportData.patient.fullName}</h2>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-semibold">
                          {reportData.patient.patientCode}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span>Age/Gender: <strong>{reportData.patient.age || '—'} Y / {reportData.patient.gender}</strong></span>
                        <span>Blood Group: <strong>{reportData.patient.bloodGroup}</strong></span>
                        <span>Hospital: <strong>{reportData.patient.clinicName}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-muted-foreground">
                    <div>Registered Mobile: <span className="font-mono font-medium text-foreground">{reportData.patient.mobile}</span></div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified Patient Profile
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reports Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 max-w-xl">
                <TabsTrigger value="lab" className="gap-1.5">
                  <FlaskConical className="h-4 w-4" /> Lab Tests ({reportData.labOrders?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="prescriptions" className="gap-1.5">
                  <Pill className="h-4 w-4" /> Prescriptions ({reportData.prescriptions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="bills" className="gap-1.5">
                  <Receipt className="h-4 w-4" /> Invoices ({reportData.bills?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="visits" className="gap-1.5">
                  <Calendar className="h-4 w-4" /> Visits ({reportData.appointments?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Lab Reports */}
              <TabsContent value="lab" className="space-y-4 pt-3">
                {reportData.labOrders && reportData.labOrders.length > 0 ? (
                  reportData.labOrders.map((order: any) => (
                    <Card key={order.id} className={`overflow-hidden ${order.hasCritical ? 'border-rose-500/50' : order.hasAbnormal ? 'border-amber-500/50' : ''}`}>
                      <CardHeader className="bg-muted/40 py-3.5 flex flex-row items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <CardTitle className="text-base font-bold font-mono">{order.orderNumber}</CardTitle>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800'}`}>
                              {order.status}
                            </span>
                            {order.hasCritical && (
                              <span className="text-xs px-2 py-0.5 rounded bg-rose-600 text-white font-bold animate-pulse">
                                Critical Values
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Date: {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '—'} • Referred by: Dr. {order.doctorName}
                          </p>
                        </div>
                        <Button 
                          onClick={() => handleDownloadPdf(order.pdfUrl, `Lab-Report-${order.orderNumber}.pdf`)}
                          size="sm"
                          className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                        >
                          <Download className="h-4 w-4" /> Download Lab PDF
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/20">
                              <TableHead>Diagnostic Investigation</TableHead>
                              <TableHead>Observed Value</TableHead>
                              <TableHead>Reference Range</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead>Status / Flag</TableHead>
                              <TableHead>Clinical Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {order.results?.map((res: any) => (
                              <TableRow key={res.id} className={res.isAbnormal ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                                <TableCell className="font-medium text-foreground">{res.testName}</TableCell>
                                <TableCell className="font-mono font-bold text-base">
                                  {res.resultValue || 'Awaiting'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{res.referenceRange || '—'}</TableCell>
                                <TableCell className="text-xs font-mono">{res.unit || '—'}</TableCell>
                                <TableCell>{getFlagBadge(res.flag, res.isAbnormal)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">{res.remarks || '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center text-muted-foreground">
                    <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No diagnostic lab orders recorded for this patient.</p>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 2: Prescriptions */}
              <TabsContent value="prescriptions" className="space-y-4 pt-3">
                {reportData.prescriptions && reportData.prescriptions.length > 0 ? (
                  reportData.prescriptions.map((rx: any) => (
                    <Card key={rx.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/40 py-3.5 flex flex-row items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <CardTitle className="text-base font-bold font-mono text-teal-700 dark:text-teal-400">{rx.rxNumber}</CardTitle>
                            <span className="text-xs text-muted-foreground">• {rx.department}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Issued by: <strong className="text-foreground">{rx.doctorName}</strong> on {rx.date ? new Date(rx.date).toLocaleDateString() : '—'}
                          </p>
                        </div>
                        <Button 
                          onClick={() => handleDownloadPdf(rx.pdfUrl, `Prescription-${rx.rxNumber}.pdf`)}
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                        >
                          <Download className="h-4 w-4 text-primary" /> Download Rx PDF
                        </Button>
                      </CardHeader>
                      <CardContent className="p-4 space-y-4">
                        {rx.notes && (
                          <div className="p-3 bg-muted/30 rounded-lg text-xs">
                            <span className="font-semibold text-foreground">Doctor's Advice / Diagnosis: </span>
                            <span className="text-muted-foreground">{rx.notes}</span>
                          </div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Prescribed Medicines (Rx)</h4>
                          <div className="border rounded-md overflow-hidden">
                            <Table>
                              <TableHeader className="bg-muted/20">
                                <TableRow>
                                  <TableHead>Medicine Name</TableHead>
                                  <TableHead>Dosage</TableHead>
                                  <TableHead>Frequency</TableHead>
                                  <TableHead>Duration</TableHead>
                                  <TableHead>Instructions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {rx.medicines?.map((med: any) => (
                                  <TableRow key={med.id}>
                                    <TableCell className="font-semibold text-foreground">{med.medicineName}</TableCell>
                                    <TableCell className="font-mono text-xs">{med.dosage}</TableCell>
                                    <TableCell className="font-mono text-xs">{med.frequency}</TableCell>
                                    <TableCell className="text-xs">{med.durationDays}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{med.instructions}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Pill className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No prescriptions recorded for this patient.</p>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 3: Bills & Tax Invoices */}
              <TabsContent value="bills" className="space-y-4 pt-3">
                {reportData.bills && reportData.bills.length > 0 ? (
                  reportData.bills.map((bill: any) => (
                    <Card key={bill.id} className="overflow-hidden">
                      <CardHeader className="bg-muted/40 py-3.5 flex flex-row items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <CardTitle className="text-base font-bold font-mono">{bill.billNumber}</CardTitle>
                            <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold uppercase">
                              {bill.paymentStatus}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground font-mono uppercase">
                              {bill.paymentMode}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Date: {bill.date ? new Date(bill.date).toLocaleDateString() : '—'} • HSN/SAC: 9993
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-foreground font-mono">₹{bill.totalAmount.toFixed(2)}</div>
                            <div className="text-[11px] text-muted-foreground">Paid Total</div>
                          </div>
                          <Button 
                            onClick={() => handleDownloadPdf(bill.pdfUrl, `Invoice-${bill.billNumber}.pdf`)}
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                          >
                            <Download className="h-4 w-4 text-primary" /> Receipt PDF
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <div className="border rounded-md overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Qty</TableHead>
                                <TableHead className="text-right">Unit Rate (₹)</TableHead>
                                <TableHead className="text-right">Amount (₹)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bill.lineItems?.map((item: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">{item.description}</TableCell>
                                  <TableCell className="text-right font-mono">{item.quantity || 1}</TableCell>
                                  <TableCell className="text-right font-mono">₹{parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}</TableCell>
                                  <TableCell className="text-right font-mono font-semibold">₹{parseFloat(item.amount || (item.quantity || 1) * (item.unit_price || 0)).toFixed(2)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="flex justify-end gap-6 text-xs text-muted-foreground pt-1 pr-2">
                          <span>Subtotal: <strong>₹{bill.subtotal.toFixed(2)}</strong></span>
                          <span>CGST (9%): <strong>₹{bill.cgstAmount.toFixed(2)}</strong></span>
                          <span>SGST (9%): <strong>₹{bill.sgstAmount.toFixed(2)}</strong></span>
                          <span className="text-foreground font-bold text-sm">Grand Total: ₹{bill.totalAmount.toFixed(2)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No billing receipts recorded for this patient.</p>
                  </Card>
                )}
              </TabsContent>

              {/* Tab 4: Visits & History */}
              <TabsContent value="visits" className="space-y-4 pt-3">
                {reportData.appointments && reportData.appointments.length > 0 ? (
                  <Card>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead>Token No.</TableHead>
                            <TableHead>Visit Date</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Attending Doctor</TableHead>
                            <TableHead className="text-right">Consultation Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.appointments.map((apt: any) => (
                            <TableRow key={apt.id}>
                              <TableCell className="font-mono font-bold">{apt.tokenNumber || `Token #${apt.queueNumber}`}</TableCell>
                              <TableCell className="text-xs">{apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString() : '—'}</TableCell>
                              <TableCell className="text-xs font-medium">{apt.department}</TableCell>
                              <TableCell className="text-xs">Dr. {apt.doctorName}</TableCell>
                              <TableCell className="text-right">
                                <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase bg-secondary text-secondary-foreground">
                                  {apt.status}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No appointment history recorded.</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State when searched and not found */}
        {searched && !isLoading && !reportData && (
          <Card className="p-12 text-center text-muted-foreground border-dashed">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30 text-teal-600" />
            <h3 className="text-lg font-bold text-foreground">No Medical Records Found</h3>
            <p className="text-sm max-w-sm mx-auto mt-1">
              Please double-check the Patient Serial Number or registered mobile number and try again.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}
