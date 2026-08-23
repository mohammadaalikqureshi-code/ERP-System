import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useClinicSettings, useUpdateClinicSettings, useClinicBranding, useUpdateClinicBranding } from '@/api/settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Building2, CreditCard, MessageSquare, Volume2, Palette, Save, Loader2 } from 'lucide-react';

const ClinicSettingsContent = () => {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const clinicId = user?.clinicId || '';

  const { data: settings, isLoading: loadingSettings } = useClinicSettings(clinicId);
  const { data: branding, isLoading: loadingBranding } = useClinicBranding(clinicId);
  const updateSettings = useUpdateClinicSettings();
  const updateBranding = useUpdateClinicBranding();

  // Local form state
  const [settingsForm, setSettingsForm] = useState<Record<string, any>>({});
  const [brandingForm, setBrandingForm] = useState<Record<string, any>>({});

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({ clinicId, data: settingsForm });
      toast({ title: 'Settings saved successfully' });
      setSettingsForm({});
    } catch (e: any) {
      toast({ title: 'Failed to save settings', description: e.message, variant: 'destructive' });
    }
  };

  const handleSaveBranding = async () => {
    try {
      await updateBranding.mutateAsync({ clinicId, data: brandingForm });
      toast({ title: 'Branding saved successfully' });
      setBrandingForm({});
    } catch (e: any) {
      toast({ title: 'Failed to save branding', description: e.message, variant: 'destructive' });
    }
  };

  const getVal = (source: any, form: Record<string, any>, key: string, fallback: any = '') =>
    form[key] !== undefined ? form[key] : source?.[key] ?? fallback;

  if (loadingSettings || loadingBranding) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Clinic Settings" description="Configure your clinic's branding, billing, communications, and integrations." />

      <Tabs defaultValue="branding">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="branding" className="gap-2"><Palette className="h-4 w-4" /> Branding</TabsTrigger>
          <TabsTrigger value="billing" className="gap-2"><Building2 className="h-4 w-4" /> GST & Billing</TabsTrigger>
          <TabsTrigger value="payment" className="gap-2"><CreditCard className="h-4 w-4" /> Payment Gateway</TabsTrigger>
          <TabsTrigger value="sms" className="gap-2"><MessageSquare className="h-4 w-4" /> SMS / WhatsApp</TabsTrigger>
          <TabsTrigger value="tts" className="gap-2"><Volume2 className="h-4 w-4" /> Voice / TTS</TabsTrigger>
        </TabsList>

        {/* === BRANDING TAB === */}
        <TabsContent value="branding">
          <Card>
            <CardHeader><CardTitle>Hospital Branding</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input
                    placeholder="e.g. Excellence in Healthcare"
                    value={getVal(branding, brandingForm, 'tagline')}
                    onChange={(e) => setBrandingForm(p => ({ ...p, tagline: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primary Brand Color</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="h-10 w-14 rounded border cursor-pointer"
                      value={getVal(branding, brandingForm, 'primaryColor', '#0d9488')}
                      onChange={(e) => setBrandingForm(p => ({ ...p, primaryColor: e.target.value }))}
                    />
                    <Input
                      value={getVal(branding, brandingForm, 'primaryColor', '#0d9488')}
                      onChange={(e) => setBrandingForm(p => ({ ...p, primaryColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GST Number (GSTIN)</Label>
                  <Input
                    placeholder="22AAAAA0000A1Z5"
                    value={getVal(branding, brandingForm, 'gstNumber')}
                    onChange={(e) => setBrandingForm(p => ({ ...p, gstNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input
                    placeholder="Hospital registration no."
                    value={getVal(branding, brandingForm, 'registrationNumber')}
                    onChange={(e) => setBrandingForm(p => ({ ...p, registrationNumber: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Drug License Number</Label>
                  <Input
                    placeholder="Drug license no."
                    value={getVal(branding, brandingForm, 'drugLicenseNumber')}
                    onChange={(e) => setBrandingForm(p => ({ ...p, drugLicenseNumber: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={getVal(branding, brandingForm, 'logoUrl')}
                    onChange={(e) => setBrandingForm(p => ({ ...p, logoUrl: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Invoice Footer Text</Label>
                <Input
                  placeholder="Computer-generated invoice — no signature required."
                  value={getVal(branding, brandingForm, 'footerText')}
                  onChange={(e) => setBrandingForm(p => ({ ...p, footerText: e.target.value }))}
                />
              </div>
              <Button onClick={handleSaveBranding} disabled={updateBranding.isPending || Object.keys(brandingForm).length === 0}>
                {updateBranding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Branding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === GST & BILLING TAB === */}
        <TabsContent value="billing">
          <Card>
            <CardHeader><CardTitle>GST Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Total GST Rate (%)</Label>
                  <Input
                    type="number" step="0.5"
                    value={getVal(settings, settingsForm, 'gstRate', 18)}
                    onChange={(e) => {
                      const total = parseFloat(e.target.value) || 0;
                      setSettingsForm(p => ({ ...p, gstRate: total, cgstRate: total / 2, sgstRate: total / 2 }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>CGST Rate (%)</Label>
                  <Input
                    type="number" step="0.5"
                    value={getVal(settings, settingsForm, 'cgstRate', 9)}
                    onChange={(e) => setSettingsForm(p => ({ ...p, cgstRate: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>SGST Rate (%)</Label>
                  <Input
                    type="number" step="0.5"
                    value={getVal(settings, settingsForm, 'sgstRate', 9)}
                    onChange={(e) => setSettingsForm(p => ({ ...p, sgstRate: parseFloat(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                GST is automatically split into CGST and SGST on all invoices. HSN/SAC code 9993 is used for healthcare services.
              </p>
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending || Object.keys(settingsForm).length === 0}>
                {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save GST Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === PAYMENT GATEWAY TAB === */}
        <TabsContent value="payment">
          <Card>
            <CardHeader><CardTitle>Razorpay Payment Gateway</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Razorpay account to accept online payments (UPI, Cards, Net Banking). Get your keys from{' '}
                <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener" className="text-teal-600 underline">
                  Razorpay Dashboard → API Keys
                </a>
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Razorpay Key ID</Label>
                  <Input
                    placeholder="rzp_live_xxxxxxxxxxxxx"
                    value={getVal(settings, settingsForm, 'razorpayKeyId')}
                    onChange={(e) => setSettingsForm(p => ({ ...p, razorpayKeyId: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Razorpay Key Secret</Label>
                  <Input
                    type="password"
                    placeholder="••••••••••••••••"
                    value={getVal(settings, settingsForm, 'razorpayKeySecret')}
                    onChange={(e) => setSettingsForm(p => ({ ...p, razorpayKeySecret: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending || Object.keys(settingsForm).length === 0}>
                {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Payment Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === SMS / WHATSAPP TAB === */}
        <TabsContent value="sms">
          <Card>
            <CardHeader><CardTitle>SMS & WhatsApp Notifications</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>SMS Provider</Label>
                  <Select
                    value={getVal(settings, settingsForm, 'smsProvider', '')}
                    onValueChange={(v) => setSettingsForm(p => ({ ...p, smsProvider: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="twilio">Twilio</SelectItem>
                      <SelectItem value="msg91">MSG91</SelectItem>
                      <SelectItem value="gupshup">Gupshup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Key / Auth Token</Label>
                  <Input
                    type="password"
                    placeholder="Your API key"
                    value={getVal(settings, settingsForm, 'smsApiKey')}
                    onChange={(e) => setSettingsForm(p => ({ ...p, smsApiKey: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sender ID</Label>
                  <Input
                    placeholder="HOSPTL"
                    value={getVal(settings, settingsForm, 'smsSenderId')}
                    onChange={(e) => setSettingsForm(p => ({ ...p, smsSenderId: e.target.value }))}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-3">
                <h4 className="font-medium">Auto-Send Notifications</h4>
                <div className="flex items-center justify-between">
                  <Label>Appointment confirmation SMS</Label>
                  <Switch
                    checked={getVal(settings, settingsForm, 'autoSmsAppointment', true)}
                    onCheckedChange={(v) => setSettingsForm(p => ({ ...p, autoSmsAppointment: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Prescription ready SMS</Label>
                  <Switch
                    checked={getVal(settings, settingsForm, 'autoSmsPrescription', true)}
                    onCheckedChange={(v) => setSettingsForm(p => ({ ...p, autoSmsPrescription: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Lab report ready SMS</Label>
                  <Switch
                    checked={getVal(settings, settingsForm, 'autoSmsLabReport', true)}
                    onCheckedChange={(v) => setSettingsForm(p => ({ ...p, autoSmsLabReport: v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable WhatsApp messages</Label>
                  <Switch
                    checked={getVal(settings, settingsForm, 'whatsappEnabled', false)}
                    onCheckedChange={(v) => setSettingsForm(p => ({ ...p, whatsappEnabled: v }))}
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending || Object.keys(settingsForm).length === 0}>
                {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save SMS Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === TTS / VOICE TAB === */}
        <TabsContent value="tts">
          <Card>
            <CardHeader><CardTitle>Voice Token Calling (TTS)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When enabled, the Queue Display screen will automatically announce token numbers using the browser's
                Text-to-Speech engine. No external service required.
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-base">Enable TTS Voice Calling</Label>
                <Switch
                  checked={getVal(settings, settingsForm, 'ttsEnabled', true)}
                  onCheckedChange={(v) => setSettingsForm(p => ({ ...p, ttsEnabled: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>TTS Language</Label>
                <Select
                  value={getVal(settings, settingsForm, 'ttsLanguage', 'en-IN')}
                  onValueChange={(v) => setSettingsForm(p => ({ ...p, ttsLanguage: v }))}
                >
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-IN">English (India)</SelectItem>
                    <SelectItem value="hi-IN">Hindi</SelectItem>
                    <SelectItem value="ta-IN">Tamil</SelectItem>
                    <SelectItem value="te-IN">Telugu</SelectItem>
                    <SelectItem value="kn-IN">Kannada</SelectItem>
                    <SelectItem value="ml-IN">Malayalam</SelectItem>
                    <SelectItem value="mr-IN">Marathi</SelectItem>
                    <SelectItem value="bn-IN">Bengali</SelectItem>
                    <SelectItem value="gu-IN">Gujarati</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveSettings} disabled={updateSettings.isPending || Object.keys(settingsForm).length === 0}>
                {updateSettings.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save TTS Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default function ClinicSettingsPage() {
  return (
    <ErrorBoundary>
      <ClinicSettingsContent />
    </ErrorBoundary>
  );
}
